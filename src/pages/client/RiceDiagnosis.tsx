import {
  AlertTriangle,
  ArrowRight,
  Camera,
  CheckCircle2,
  Leaf,
  LoaderCircle,
  MessageCircle,
  RefreshCw,
  ShoppingCart,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent,
} from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../../hooks/useCart';
import { triggerCartFlyAnimation } from '../../hooks/useCartAnimation';
import { useClientSession } from '../../hooks/useClientSession';
import { useToast } from '../../hooks/useToast';
import { clientApi } from '../../lib/client-api';
import {
  formatConfidence,
  formatPercent,
  getQualityIssueLabel,
  formatPrice,
  getRecommendationLabel,
  getRecommendationTone,
  getRiceSeverityLabel,
  getRiceSeverityTone,
  openSupportChatWidget,
  type RiceDiagnosisHistoryItem,
  type RiceDiagnosisProduct,
  type RiceDiagnosisResult,
  type RiceDisease,
} from '../../lib/rice-diagnosis';

function ProductRecommendationCard({
  product,
  loading,
  onAddToCart,
}: {
  product: RiceDiagnosisProduct;
  loading: boolean;
  onAddToCart: (event: MouseEvent<HTMLButtonElement>, productId: string) => void;
}) {
  const effectivePrice = Number(product.effectivePrice);
  const basePrice = Number(product.basePrice);
  const hasDiscount = effectivePrice < basePrice - 0.01;

  return (
    <div className="group overflow-hidden rounded-[1.75rem] border border-black/8 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
      <Link to={`/client/products/${product.productId}`} className="block bg-[#edf3ee]">
        {product.primaryImageUrl ? (
          <img
            src={product.primaryImageUrl}
            alt={product.productName}
            className="h-44 w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-44 items-center justify-center">
            <Leaf size={34} className="text-[#006241]/20" />
          </div>
        )}
      </Link>

      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            {product.category ? (
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#006241]/65">
                {product.category.categoryName}
              </p>
            ) : null}
            <Link
              to={`/client/products/${product.productId}`}
              className="mt-1 line-clamp-2 text-base font-black text-[#1E3932] transition hover:text-[#006241]"
            >
              {product.productName}
            </Link>
          </div>

          <span className="rounded-full bg-[#edf3ee] px-2.5 py-1 text-[11px] font-bold text-[#006241]">
            {product.quantityAvailable > 0 ? `Con ${product.quantityAvailable}` : 'Het hang'}
          </span>
        </div>

        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-lg font-black text-[#006241]">
            {formatPrice(effectivePrice)}
          </span>
          {hasDiscount ? (
            <span className="text-sm text-gray-400 line-through">
              {formatPrice(basePrice)}
            </span>
          ) : null}
        </div>

        <div className="flex gap-2">
          <Link
            to={`/client/products/${product.productId}`}
            className="flex-1 rounded-full border border-[#006241]/20 px-4 py-2.5 text-center text-sm font-bold text-[#006241] transition hover:bg-[#006241]/8"
          >
            Xem chi tiet
          </Link>
          <button
            type="button"
            onClick={(event) => onAddToCart(event, product.productId)}
            disabled={loading || product.quantityAvailable <= 0}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-[#006241] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#004e34] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <LoaderCircle size={15} className="animate-spin" />
            ) : (
              <>
                <ShoppingCart size={15} />
                Them vao gio
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

const MAX_UPLOAD_SIZE_BYTES = 8 * 1024 * 1024;

function formatFileSize(size: number) {
  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export default function RiceDiagnosis() {
  const { session } = useClientSession();
  const { addItem } = useCart();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [diseases, setDiseases] = useState<RiceDisease[]>([]);
  const [history, setHistory] = useState<RiceDiagnosisHistoryItem[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<RiceDiagnosisResult | null>(null);
  const [addingProductId, setAddingProductId] = useState<string | null>(null);
  const needsManualReview = Boolean(
    result &&
      (result.recommendationLevel === 'low' ||
        result.inferenceFlags.lowQuality ||
        result.inferenceFlags.ambiguousPrediction),
  );

  useEffect(() => {
    let cancelled = false;

    setLoadingCatalog(true);
    void clientApi
      .get<RiceDisease[]>('/rice-diagnosis/diseases')
      .then((items) => {
        if (!cancelled) {
          setDiseases(Array.isArray(items) ? items : []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDiseases([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingCatalog(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!session) {
      setHistory([]);
      return;
    }

    let cancelled = false;
    setHistoryLoading(true);

    void clientApi
      .get<RiceDiagnosisHistoryItem[]>('/rice-diagnosis/history/me')
      .then((items) => {
        if (!cancelled) {
          setHistory(Array.isArray(items) ? items : []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHistory([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setHistoryLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;

    if (nextFile && !nextFile.type.startsWith('image/')) {
      showToast({
        tone: 'error',
        title: 'Chi ho tro anh JPG, PNG, WEBP hoac dinh dang image hop le',
      });
      event.target.value = '';
      return;
    }

    if (nextFile && nextFile.size > MAX_UPLOAD_SIZE_BYTES) {
      showToast({
        tone: 'error',
        title: 'Anh vuot qua gioi han 8MB',
        description: 'Hay nen anh hoac chup lai anh nho hon truoc khi tai len.',
      });
      event.target.value = '';
      return;
    }

    setFile(nextFile);
    setResult(null);
  }

  function handleClearImage() {
    setFile(null);
    setResult(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }

  async function handleSubmit() {
    if (!file) {
      showToast({
        tone: 'error',
        title: 'Ban can chon anh la lua truoc khi kiem tra',
      });
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    setSubmitting(true);
    try {
      const endpoint = session
        ? '/rice-diagnosis/predict/me'
        : '/rice-diagnosis/predict';
      const prediction = await clientApi.postForm<RiceDiagnosisResult>(
        endpoint,
        formData,
      );
      setResult(prediction);

      if (session) {
        const nextHistory = await clientApi.get<RiceDiagnosisHistoryItem[]>(
          '/rice-diagnosis/history/me',
        );
        setHistory(Array.isArray(nextHistory) ? nextHistory : []);
      }
    } catch (error) {
      showToast({
        tone: 'error',
        title: 'Khong the hoan thanh chan doan',
        description: error instanceof Error ? error.message : '',
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddToCart(
    event: MouseEvent<HTMLButtonElement>,
    productId: string,
  ) {
    triggerCartFlyAnimation(event.currentTarget);

    if (!session) {
      void navigate('/client/login');
      return;
    }

    setAddingProductId(productId);
    try {
      await addItem(productId, 1);
      showToast({
        tone: 'success',
        title: 'Da them san pham vao gio hang',
      });
    } catch (error) {
      showToast({
        tone: 'error',
        title: 'Them vao gio hang that bai',
        description: error instanceof Error ? error.message : '',
      });
    } finally {
      setAddingProductId(null);
    }
  }

  return (
    <div style={{ background: '#f2f0eb' }} className="min-h-[80vh]">
      <div className="mx-auto max-w-7xl px-4 py-8 lg:px-6 lg:py-12">
        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="overflow-hidden rounded-[2.5rem] border border-black/8 bg-[#1f3f35] p-8 text-white shadow-[0_24px_60px_rgba(0,0,0,0.14)]">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-black uppercase tracking-[0.24em] text-white/80">
              <Leaf size={14} />
              Rice AI
            </p>

            <h1 className="mt-5 max-w-2xl text-4xl font-black leading-tight sm:text-5xl">
              Chan doan benh la lua bang AI va chuyen thang sang phac do xu ly.
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/75 sm:text-base">
              Tai anh la lua, de he thong goi model da huan luyen, tra ve ten benh,
              do tin cay, huong xu ly va nhung san pham dang co trong kho de ban co
              the mua ngay neu can.
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {[
                'Anh can chup can la, ro vet benh, du anh sang',
                'Ket qua gom top du doan va nguong tin cay',
                'Neu do tin cay thap, he thong se uu tien chat voi nhan vien',
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-[1.5rem] border border-white/10 bg-white/6 p-4 text-sm text-white/75"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2.5rem] border border-black/8 bg-white p-6 shadow-sm sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-[#006241]/70">
                  Anh chan doan
                </p>
                <h2 className="mt-2 text-2xl font-black text-[#1E3932]">
                  Tai anh la lua
                </h2>
              </div>
              <button
                type="button"
                onClick={handleClearImage}
                className="inline-flex items-center gap-1 rounded-full border border-black/10 px-3 py-1.5 text-xs font-bold text-[#1E3932] transition hover:bg-black/5"
              >
                <X size={13} />
                Xoa
              </button>
            </div>

            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="mt-6 flex w-full flex-col items-center justify-center rounded-[2rem] border border-dashed border-[#006241]/35 bg-[#edf3ee] px-6 py-10 text-center transition hover:border-[#006241]"
            >
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Rice preview"
                  className="h-56 w-full rounded-[1.5rem] object-cover"
                />
              ) : (
                <>
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-[#006241] shadow-sm">
                    <Leaf size={28} />
                  </div>
                  <p className="mt-4 text-base font-black text-[#1E3932]">
                    Chon anh la lua de kiem tra
                  </p>
                  <p className="mt-2 max-w-xs text-sm leading-6 text-gray-500">
                    Ho tro JPG, PNG. Anh nen chup mot la la chinh, canh gan, khong bi mo.
                  </p>
                </>
              )}
            </button>

            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-[#006241]/20 px-5 py-3 text-sm font-bold text-[#006241] transition hover:bg-[#006241]/8"
              >
                Chon anh
              </button>
              <button
                type="button"
                disabled={!file || submitting}
                onClick={() => void handleSubmit()}
                className="inline-flex flex-[1.3] items-center justify-center gap-2 rounded-full bg-[#006241] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#004e34] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? (
                  <LoaderCircle size={16} className="animate-spin" />
                ) : (
                  <ShieldCheck size={16} />
                )}
                Kiem tra ngay
              </button>
            </div>

            {file ? (
              <div className="mt-4 rounded-[1.25rem] bg-[#f5f7f3] px-4 py-3 text-xs font-semibold text-[#1E3932]">
                Tep da chon: {file.name} · {formatFileSize(file.size)}
              </div>
            ) : null}
          </div>
        </section>

        {result ? (
          <section className="mt-8 rounded-[2.5rem] border border-black/8 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-[#006241]/70">
                  Ket qua AI
                </p>
                <h2 className="mt-2 text-3xl font-black text-[#1E3932]">
                  {result.disease?.diseaseName ?? 'Chua doi chieu duoc voi danh muc benh'}
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">
                  {result.advisory.headline}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <span
                  className={`rounded-full border px-3 py-2 text-xs font-black ${getRecommendationTone(
                    result.recommendationLevel,
                  )}`}
                >
                  {getRecommendationLabel(result.recommendationLevel)}
                </span>
                <span className="rounded-full border border-black/10 bg-slate-50 px-3 py-2 text-xs font-black text-slate-700">
                  Confidence {formatConfidence(result.confidence)}
                </span>
                {result.inferenceFlags.lowQuality ? (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black text-amber-800">
                    Anh can chup lai
                  </span>
                ) : null}
                {result.inferenceFlags.ambiguousPrediction ? (
                  <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-black text-sky-800">
                    Can doi chieu them
                  </span>
                ) : null}
                {result.inferenceFlags.lowConfidence ? (
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-700">
                    Tin hieu yeu
                  </span>
                ) : null}
                {result.disease ? (
                  <span
                    className={`rounded-full border px-3 py-2 text-xs font-black ${getRiceSeverityTone(
                      result.disease.severity,
                    )}`}
                  >
                    Muc do {getRiceSeverityLabel(result.disease.severity)}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="space-y-6">
                <div className="rounded-[1.75rem] bg-[#f5f7f3] p-5">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[#006241]/70">
                    Giai thich
                  </p>
                  <p className="mt-3 text-sm leading-7 text-[#1E3932]">
                    {result.advisory.disclaimer}
                  </p>
                </div>

                <div
                  className={`rounded-[1.75rem] border p-5 ${
                    needsManualReview
                      ? 'border-amber-200 bg-amber-50'
                      : 'border-emerald-200 bg-emerald-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                        needsManualReview
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {needsManualReview ? (
                        <AlertTriangle size={18} />
                      ) : (
                        <CheckCircle2 size={18} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#006241]/70">
                        Tin hieu anh va do tin cay
                      </p>
                      <p className="mt-2 text-sm leading-7 text-[#1E3932]">
                        {needsManualReview
                          ? 'He thong dang uu tien muc an toan. Ban nen chup them anh khac neu la bi mo, qua toi hoac ket qua dang phan van.'
                          : 'Anh hien tai dat chat luong on dinh de tham khao ket qua AI trong pham vi bai toan 5 lop dang ho tro.'}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {result.inferenceFlags.qualityIssues.length > 0 ? (
                          result.inferenceFlags.qualityIssues.map((issue) => (
                            <span
                              key={issue}
                              className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-amber-800"
                            >
                              {getQualityIssueLabel(issue)}
                            </span>
                          ))
                        ) : (
                          <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-emerald-700">
                            Anh dat yeu cau co ban
                          </span>
                        )}
                      </div>
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <div className="rounded-[1.25rem] bg-white px-4 py-3">
                          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#006241]/70">
                            Khoang cach giua top 1 va top 2
                          </p>
                          <p className="mt-2 text-sm font-black text-[#1E3932]">
                            {result.inferenceFlags.confidenceMargin !== null
                              ? formatPercent(result.inferenceFlags.confidenceMargin)
                              : 'Khong co du lieu'}
                          </p>
                        </div>
                        <div className="rounded-[1.25rem] bg-white px-4 py-3">
                          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#006241]/70">
                            Luu lich su
                          </p>
                          <p className="mt-2 text-sm font-black text-[#1E3932]">
                            {result.savedToHistory ? 'Da luu vao lich su' : 'Chua luu'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {result.disease ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    {[
                      {
                        title: 'Tom tat',
                        body: result.disease.summary || 'Dang cap nhat noi dung tham khao.',
                      },
                      {
                        title: 'Trieu chung',
                        body: result.disease.symptoms || 'Dang cap nhat noi dung tham khao.',
                      },
                      {
                        title: 'Nguyen nhan',
                        body: result.disease.causes || 'Dang cap nhat noi dung tham khao.',
                      },
                      {
                        title: 'Huong xu ly',
                        body:
                          result.disease.treatmentGuidance ||
                          'Can doi chieu them voi nhan vien ky thuat truoc khi xu ly dien rong.',
                      },
                    ].map((card) => (
                      <div
                        key={card.title}
                        className="rounded-[1.75rem] border border-black/6 bg-white p-5"
                      >
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#006241]/70">
                          {card.title}
                        </p>
                        <p className="mt-3 text-sm leading-7 text-[#1E3932]">
                          {card.body}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}

                {result.disease?.recommendedIngredients.length ? (
                  <div className="rounded-[1.75rem] border border-black/6 bg-white p-5">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[#006241]/70">
                      Hoat chat hoac nhom xu ly tham khao
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {result.disease.recommendedIngredients.map((item) => (
                        <span
                          key={item}
                          className="rounded-full bg-[#edf3ee] px-3 py-1.5 text-xs font-bold text-[#006241]"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="space-y-6">
                <div className="rounded-[1.75rem] border border-black/6 bg-white p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[#006241]/70">
                      Top du doan
                    </p>
                    <span className="text-xs font-semibold text-gray-400">
                      {result.model.version ?? 'Model'}
                    </span>
                  </div>
                  <div className="mt-4 space-y-3">
                    {result.topPredictions.map((prediction) => (
                      <div key={`${prediction.normalizedKey}-${prediction.label}`}>
                        <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                          <span className="font-semibold text-[#1E3932]">
                            {prediction.diseaseName}
                          </span>
                          <span className="font-black text-[#006241]">
                            {formatConfidence(prediction.confidence)}
                          </span>
                        </div>
                        <div className="h-2.5 overflow-hidden rounded-full bg-[#edf3ee]">
                          <div
                            className="h-full rounded-full bg-[#006241]"
                            style={{ width: `${Math.max(8, prediction.confidence * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[1.75rem] border border-black/6 bg-white p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#006241]/70">
                        Can nhan vien xem them?
                      </p>
                      <p className="mt-2 text-sm leading-6 text-gray-500">
                        {needsManualReview
                          ? 'Nen dung khi anh kho, la bi che khuat, confidence yeu hoac AI dang phan van giua nhieu nhan benh.'
                          : 'Van co the mo chat de duoc tu van cach xu ly, phong ngua va chon san pham phu hop.'}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => inputRef.current?.click()}
                        className="inline-flex items-center gap-2 rounded-full border border-[#006241]/20 px-4 py-2.5 text-sm font-bold text-[#006241] transition hover:bg-[#006241]/8"
                      >
                        <Camera size={15} />
                        Chon anh khac
                      </button>
                      <button
                        type="button"
                        onClick={() => openSupportChatWidget()}
                        className="inline-flex items-center gap-2 rounded-full bg-[#1E3932] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#11251f]"
                      >
                        <MessageCircle size={15} />
                        Mo chat ho tro
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[#006241]/70">
                    San pham goi y
                  </p>
                  <h3 className="mt-2 text-2xl font-black text-[#1E3932]">
                    Thuoc va vat tu dang san co
                  </h3>
                </div>
                {result.recommendedProducts.length > 0 ? (
                  <Link
                    to="/client/products"
                    className="inline-flex items-center gap-2 text-sm font-bold text-[#006241] hover:underline"
                  >
                    Xem them san pham
                    <ArrowRight size={15} />
                  </Link>
                ) : null}
              </div>

              {result.recommendedProducts.length === 0 ? (
                <div className="mt-4 rounded-[1.75rem] border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-800">
                  Hien chua co san pham duoc map truc tiep cho ket qua nay. He thong se uu tien
                  huong dan tham khao va chat voi nhan vien thay vi ep mua thuoc.
                </div>
              ) : (
                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  {result.recommendedProducts.map((product) => (
                    <div key={product.productId}>
                      <ProductRecommendationCard
                        product={product}
                        loading={addingProductId === product.productId}
                        onAddToCart={handleAddToCart}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        ) : null}

        <section className="mt-8 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[2.25rem] border border-black/8 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-[#006241]/70">
                  Thu vien benh
                </p>
                <h2 className="mt-2 text-3xl font-black text-[#1E3932]">
                  Danh muc benh lua he thong dang ho tro
                </h2>
              </div>
              {loadingCatalog ? <LoaderCircle size={18} className="animate-spin text-[#006241]" /> : null}
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {loadingCatalog
                ? Array.from({ length: 4 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-40 animate-pulse rounded-[1.75rem] bg-[#f5f7f3]"
                    />
                  ))
                : diseases.map((disease) => (
                    <div
                      key={disease.diseaseId}
                      className="rounded-[1.75rem] border border-black/6 bg-[#fdfdfc] p-5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-lg font-black text-[#1E3932]">
                            {disease.diseaseName}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-gray-500">
                            {disease.summary || 'Dang cap nhat mo ta cho benh nay.'}
                          </p>
                        </div>
                        <span
                          className={`rounded-full border px-3 py-1.5 text-[11px] font-black ${getRiceSeverityTone(
                            disease.severity,
                          )}`}
                        >
                          {getRiceSeverityLabel(disease.severity)}
                        </span>
                      </div>
                    </div>
                  ))}
            </div>
          </div>

          <div className="rounded-[2.25rem] border border-black/8 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-[#006241]/70">
                  Lich su cua ban
                </p>
                <h2 className="mt-2 text-3xl font-black text-[#1E3932]">
                  Phien chan doan gan day
                </h2>
              </div>
              {session ? (
                historyLoading ? (
                  <LoaderCircle size={18} className="animate-spin text-[#006241]" />
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setHistoryLoading(true);
                      void clientApi
                        .get<RiceDiagnosisHistoryItem[]>('/rice-diagnosis/history/me')
                        .then((items) => setHistory(Array.isArray(items) ? items : []))
                        .finally(() => setHistoryLoading(false));
                    }}
                    className="inline-flex items-center gap-2 rounded-full border border-black/10 px-3 py-2 text-xs font-bold text-[#1E3932] transition hover:bg-black/5"
                  >
                    <RefreshCw size={13} />
                    Lam moi
                  </button>
                )
              ) : null}
            </div>

            {!session ? (
              <div className="mt-6 rounded-[1.75rem] border border-[#006241]/15 bg-[#edf3ee] p-5 text-sm leading-7 text-[#1E3932]">
                Dang nhap de luu lich su chan doan, theo doi cac ket qua da kiem tra va quay lai mua
                thuoc nhanh hon.
              </div>
            ) : history.length === 0 ? (
              <div className="mt-6 rounded-[1.75rem] border border-black/8 bg-[#f5f7f3] p-5 text-sm leading-7 text-gray-500">
                Chua co lich su chan doan nao. Hay tai anh va thuc hien lan kiem tra dau tien.
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                {history.map((item) => (
                  <div
                    key={item.diagnosisId}
                    className="rounded-[1.5rem] border border-black/8 bg-[#fcfcfb] px-4 py-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-black text-[#1E3932]">
                          {item.disease?.diseaseName ?? item.predictedLabel ?? 'Khong ro'}
                        </p>
                        <p className="mt-1 text-sm text-gray-500">
                          {new Date(item.createdAt).toLocaleString('vi-VN')}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span
                          className={`rounded-full border px-3 py-1.5 text-[11px] font-black ${getRecommendationTone(
                            item.recommendationLevel,
                          )}`}
                        >
                          {getRecommendationLabel(item.recommendationLevel)}
                        </span>
                        <span className="rounded-full bg-[#edf3ee] px-3 py-1.5 text-[11px] font-black text-[#006241]">
                          {formatConfidence(item.confidence)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
