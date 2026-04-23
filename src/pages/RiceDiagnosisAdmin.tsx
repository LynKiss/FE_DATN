import {
  CheckCircle2,
  Leaf,
  LoaderCircle,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '../lib/api';
import { useAdminSession } from '../hooks/useAdminSession';
import { useToast } from '../hooks/useToast';
import {
  getRiceSeverityLabel,
  getRiceSeverityTone,
  type AdminRiceDisease,
  type AdminRiceDiseaseListResponse,
  type RiceDiagnosisProduct,
} from '../lib/rice-diagnosis';

type ServiceStatus = {
  configured: boolean;
  reachable: boolean;
  baseUrl: string;
  statusCode: number | null;
  payload: Record<string, unknown> | null;
  error?: string;
};

type RecommendedProductForm = {
  productId: string;
  note: string;
  rationale: string;
  isPrimary: boolean;
  sortOrder: number;
  product: RiceDiagnosisProduct | null;
};

type DiseaseForm = {
  diseaseKey: string;
  diseaseName: string;
  diseaseSlug: string;
  summary: string;
  symptoms: string;
  causes: string;
  treatmentGuidance: string;
  preventionGuidance: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recommendedIngredientsText: string;
  searchKeywordsText: string;
  confidenceThreshold: string;
  coverImageUrl: string;
  isActive: boolean;
  recommendedProducts: RecommendedProductForm[];
};

const emptyForm: DiseaseForm = {
  diseaseKey: '',
  diseaseName: '',
  diseaseSlug: '',
  summary: '',
  symptoms: '',
  causes: '',
  treatmentGuidance: '',
  preventionGuidance: '',
  severity: 'medium',
  recommendedIngredientsText: '',
  searchKeywordsText: '',
  confidenceThreshold: '0.90',
  coverImageUrl: '',
  isActive: true,
  recommendedProducts: [],
};

function toLineText(values: string[]) {
  return values.join('\n');
}

function toStringArray(value: string) {
  return [...new Set(value.split(/\n|,/).map((item) => item.trim()).filter(Boolean))];
}

export default function RiceDiagnosisAdmin() {
  const { session } = useAdminSession();
  const { showToast } = useToast();

  const canManage =
    session?.user.permissions?.some((permission) => permission.key === 'manage_ai_diagnosis') ?? false;

  const [serviceStatus, setServiceStatus] = useState<ServiceStatus | null>(null);
  const [serviceLoading, setServiceLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [list, setList] = useState<AdminRiceDisease[]>([]);
  const [search, setSearch] = useState('');
  const [activeOnly, setActiveOnly] = useState<'all' | 'active' | 'inactive'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<DiseaseForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [productLoading, setProductLoading] = useState(false);
  const [productOptions, setProductOptions] = useState<RiceDiagnosisProduct[]>([]);

  const filteredList = useMemo(() => {
    return list.filter((item) => {
      if (activeOnly === 'active' && !item.isActive) return false;
      if (activeOnly === 'inactive' && item.isActive) return false;
      if (!search.trim()) return true;

      const keyword = search.trim().toLowerCase();
      return (
        item.diseaseName.toLowerCase().includes(keyword) ||
        item.diseaseKey.toLowerCase().includes(keyword) ||
        item.diseaseSlug.toLowerCase().includes(keyword)
      );
    });
  }, [activeOnly, list, search]);

  useEffect(() => {
    if (!canManage) return;
    void loadPage();
    void loadServiceStatus();
  }, [canManage]);

  async function loadPage() {
    setListLoading(true);
    try {
      const data = await apiClient.get<AdminRiceDiseaseListResponse>(
        '/rice-diagnosis/admin/diseases?page=1&limit=100',
      );
      setList(Array.isArray(data.items) ? data.items : []);
    } catch (error) {
      showToast({
        tone: 'error',
        title: 'Khong tai duoc danh muc benh',
        description: error instanceof Error ? error.message : '',
      });
      setList([]);
    } finally {
      setListLoading(false);
    }
  }

  async function loadServiceStatus() {
    setServiceLoading(true);
    try {
      const data = await apiClient.get<ServiceStatus>('/rice-diagnosis/admin/service-status');
      setServiceStatus(data);
    } catch (error) {
      showToast({
        tone: 'error',
        title: 'Khong kiem tra duoc AI service',
        description: error instanceof Error ? error.message : '',
      });
      setServiceStatus(null);
    } finally {
      setServiceLoading(false);
    }
  }

  async function searchProducts(value: string) {
    setProductSearch(value);
    if (!value.trim()) {
      setProductOptions([]);
      return;
    }

    setProductLoading(true);
    try {
      const items = await apiClient.get<RiceDiagnosisProduct[]>(
        `/rice-diagnosis/admin/products?search=${encodeURIComponent(value.trim())}&limit=12`,
      );
      setProductOptions(Array.isArray(items) ? items : []);
    } catch {
      setProductOptions([]);
    } finally {
      setProductLoading(false);
    }
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setProductOptions([]);
    setProductSearch('');
    setModalOpen(true);
  }

  async function openEdit(diseaseId: string) {
    try {
      const detail = await apiClient.get<AdminRiceDisease>(
        `/rice-diagnosis/admin/diseases/${diseaseId}`,
      );

      setEditingId(diseaseId);
      setForm({
        diseaseKey: detail.diseaseKey,
        diseaseName: detail.diseaseName,
        diseaseSlug: detail.diseaseSlug,
        summary: detail.summary ?? '',
        symptoms: detail.symptoms ?? '',
        causes: detail.causes ?? '',
        treatmentGuidance: detail.treatmentGuidance ?? '',
        preventionGuidance: detail.preventionGuidance ?? '',
        severity: detail.severity,
        recommendedIngredientsText: toLineText(detail.recommendedIngredients),
        searchKeywordsText: toLineText(detail.searchKeywords),
        confidenceThreshold: String(detail.confidenceThreshold),
        coverImageUrl: detail.coverImageUrl ?? '',
        isActive: detail.isActive,
        recommendedProducts: (detail.recommendedProducts ?? []).map((item, index) => ({
          productId: item.productId,
          note: item.note ?? '',
          rationale: item.rationale ?? '',
          isPrimary: item.isPrimary || index === 0,
          sortOrder: item.sortOrder ?? index,
          product: item.product ?? null,
        })),
      });
      setProductOptions([]);
      setProductSearch('');
      setModalOpen(true);
    } catch (error) {
      showToast({
        tone: 'error',
        title: 'Khong tai duoc chi tiet benh',
        description: error instanceof Error ? error.message : '',
      });
    }
  }

  function addRecommendedProduct(product: RiceDiagnosisProduct) {
    setForm((current) => {
      if (current.recommendedProducts.some((item) => item.productId === product.productId)) {
        return current;
      }

      return {
        ...current,
        recommendedProducts: [
          ...current.recommendedProducts,
          {
            productId: product.productId,
            note: '',
            rationale: '',
            isPrimary: current.recommendedProducts.length === 0,
            sortOrder: current.recommendedProducts.length,
            product,
          },
        ],
      };
    });
  }

  function updateRecommendedProduct(
    productId: string,
    patch: Partial<RecommendedProductForm>,
  ) {
    setForm((current) => ({
      ...current,
      recommendedProducts: current.recommendedProducts.map((item) =>
        item.productId === productId ? { ...item, ...patch } : item,
      ),
    }));
  }

  function removeRecommendedProduct(productId: string) {
    setForm((current) => {
      const next = current.recommendedProducts.filter((item) => item.productId !== productId);
      return {
        ...current,
        recommendedProducts: next.map((item, index) => ({
          ...item,
          isPrimary: index === 0 ? true : item.isPrimary,
          sortOrder: index,
        })),
      };
    });
  }

  async function handleSave() {
    if (!form.diseaseName.trim() || !form.diseaseKey.trim()) {
      showToast({
        tone: 'error',
        title: 'Ten benh va disease key la bat buoc',
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        diseaseKey: form.diseaseKey.trim(),
        diseaseName: form.diseaseName.trim(),
        diseaseSlug: form.diseaseSlug.trim() || undefined,
        summary: form.summary.trim() || undefined,
        symptoms: form.symptoms.trim() || undefined,
        causes: form.causes.trim() || undefined,
        treatmentGuidance: form.treatmentGuidance.trim() || undefined,
        preventionGuidance: form.preventionGuidance.trim() || undefined,
        severity: form.severity,
        recommendedIngredients: toStringArray(form.recommendedIngredientsText),
        searchKeywords: toStringArray(form.searchKeywordsText),
        confidenceThreshold: Number(form.confidenceThreshold || '0.9'),
        coverImageUrl: form.coverImageUrl.trim() || undefined,
        isActive: form.isActive,
        recommendedProducts: form.recommendedProducts.map((item, index) => ({
          productId: item.productId,
          note: item.note.trim() || undefined,
          rationale: item.rationale.trim() || undefined,
          isPrimary: item.isPrimary || index === 0,
          sortOrder: index,
        })),
      };

      if (editingId) {
        await apiClient.patch(`/rice-diagnosis/admin/diseases/${editingId}`, payload);
      } else {
        await apiClient.post('/rice-diagnosis/admin/diseases', payload);
      }

      showToast({
        tone: 'success',
        title: editingId ? 'Da cap nhat danh muc benh' : 'Da tao benh moi',
      });
      setModalOpen(false);
      setForm(emptyForm);
      await loadPage();
    } catch (error) {
      showToast({
        tone: 'error',
        title: 'Luu danh muc benh that bai',
        description: error instanceof Error ? error.message : '',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(diseaseId: string) {
    try {
      await apiClient.patch(`/rice-diagnosis/admin/diseases/${diseaseId}/toggle-active`, {});
      await loadPage();
    } catch (error) {
      showToast({
        tone: 'error',
        title: 'Khong doi duoc trang thai benh',
        description: error instanceof Error ? error.message : '',
      });
    }
  }

  if (!canManage) {
    return (
      <div className="rounded-[2rem] border border-amber-200 bg-amber-50 p-8 text-amber-800">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100">
          <ShieldCheck size={24} />
        </div>
        <h1 className="mt-4 text-2xl font-black">Khong du quyen truy cap</h1>
        <p className="mt-2 text-sm">
          Tai khoan hien tai can quyen <code>manage_ai_diagnosis</code> de quan ly module chan doan benh lua.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-primary/70">
            AI Diagnosis
          </p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-primary">
            Quan ly chan doan benh lua
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-on-surface-variant">
            Quan ly danh muc benh, nguong confidence, keyword fallback va cac san pham map truc tiep
            tu ket qua AI sang gian hang.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void loadServiceStatus()}
            className="inline-flex items-center gap-2 rounded-xl border border-on-surface/10 bg-white px-4 py-3 text-sm font-bold text-on-surface transition hover:border-primary/20"
          >
            {serviceLoading ? (
              <LoaderCircle size={16} className="animate-spin" />
            ) : (
              <RefreshCw size={16} />
            )}
            Kiem tra AI service
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-container px-5 py-3 text-sm font-black text-white shadow-xl shadow-primary/20 transition hover:-translate-y-0.5"
          >
            <Plus size={16} />
            Them benh moi
          </button>
        </div>
      </div>

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[2rem] border border-on-surface/8 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-on-surface-variant/60">
                AI service
              </p>
              <h2 className="mt-2 text-2xl font-black text-on-surface">Trang thai ket noi Flask</h2>
            </div>
            {serviceStatus?.reachable ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700">
                <CheckCircle2 size={14} />
                Online
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-700">
                <RefreshCw size={14} />
                Kiem tra lai
              </span>
            )}
          </div>

          <div className="mt-5 space-y-4 text-sm">
            <div className="rounded-2xl bg-surface px-4 py-3">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-on-surface-variant/60">
                Endpoint
              </p>
              <p className="mt-2 break-all font-semibold text-on-surface">
                {serviceStatus?.baseUrl ?? 'Dang tai...'}
              </p>
            </div>
            <div className="rounded-2xl bg-surface px-4 py-3">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-on-surface-variant/60">
                Response
              </p>
              <p className="mt-2 text-on-surface-variant">
                {serviceStatus?.reachable
                  ? `HTTP ${serviceStatus.statusCode ?? '-'}`
                  : serviceStatus?.error ?? 'Chua co du lieu'}
              </p>
              {serviceStatus?.payload ? (
                <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-950 px-4 py-3 text-xs text-slate-100">
                  {JSON.stringify(serviceStatus.payload, null, 2)}
                </pre>
              ) : null}
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-on-surface/8 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[240px] flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tim theo ten benh, key, slug..."
                className="w-full rounded-xl border border-on-surface/10 bg-surface py-3 pl-10 pr-4 text-sm outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/10"
              />
            </div>
            <select
              value={activeOnly}
              onChange={(event) => setActiveOnly(event.target.value as typeof activeOnly)}
              className="rounded-xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none focus:border-primary/30"
            >
              <option value="all">Tat ca</option>
              <option value="active">Dang hoat dong</option>
              <option value="inactive">Tam an</option>
            </select>
          </div>

          <div className="mt-5">
            {listLoading ? (
              <div className="flex items-center justify-center py-12">
                <LoaderCircle size={20} className="animate-spin text-primary" />
              </div>
            ) : filteredList.length === 0 ? (
              <div className="rounded-2xl bg-surface px-4 py-10 text-center text-sm text-on-surface-variant">
                Chua co benh nao phu hop voi bo loc hien tai.
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {filteredList.map((item) => (
                  <div
                    key={item.diseaseId}
                    className="rounded-[1.75rem] border border-on-surface/8 bg-surface/40 p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Leaf size={16} className="text-primary" />
                          <p className="text-lg font-black text-on-surface">
                            {item.diseaseName}
                          </p>
                        </div>
                        <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-on-surface-variant/60">
                          {item.diseaseKey}
                        </p>
                      </div>
                      <span
                        className={`rounded-full border px-3 py-1.5 text-[11px] font-black ${getRiceSeverityTone(
                          item.severity,
                        )}`}
                      >
                        {getRiceSeverityLabel(item.severity)}
                      </span>
                    </div>

                    <p className="mt-4 line-clamp-3 text-sm leading-6 text-on-surface-variant">
                      {item.summary || 'Chua co mo ta tom tat cho benh nay.'}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
                      <span className="rounded-full bg-white px-3 py-1.5 text-on-surface">
                        Threshold {item.confidenceThreshold}
                      </span>
                      <span className="rounded-full bg-white px-3 py-1.5 text-on-surface">
                        Map {item.mappedProductCount} san pham
                      </span>
                      <span
                        className={`rounded-full px-3 py-1.5 ${
                          item.isActive
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {item.isActive ? 'Dang hoat dong' : 'Tam an'}
                      </span>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void openEdit(item.diseaseId)}
                        className="rounded-full border border-primary/20 px-4 py-2 text-sm font-bold text-primary transition hover:bg-primary/8"
                      >
                        Chinh sua
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleToggleActive(item.diseaseId)}
                        className="rounded-full border border-on-surface/10 px-4 py-2 text-sm font-bold text-on-surface transition hover:bg-on-surface/5"
                      >
                        {item.isActive ? 'Tam an' : 'Kich hoat'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4">
          <div className="max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-[2rem] bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-on-surface/8 bg-white px-6 py-5">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-on-surface-variant/60">
                  {editingId ? 'Cap nhat' : 'Tao moi'}
                </p>
                <h2 className="mt-1 text-2xl font-black text-on-surface">
                  {editingId ? 'Cap nhat danh muc benh' : 'Them benh lua moi'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-on-surface/10 text-on-surface-variant transition hover:bg-on-surface/5"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-6 px-6 py-6 xl:grid-cols-[1.05fr_0.95fr]">
              <div className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-1.5">
                    <span className="text-xs font-black uppercase tracking-[0.14em] text-on-surface-variant/60">
                      Disease key
                    </span>
                    <input
                      value={form.diseaseKey}
                      onChange={(event) => setForm((current) => ({ ...current, diseaseKey: event.target.value }))}
                      className="w-full rounded-xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/10"
                    />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-black uppercase tracking-[0.14em] text-on-surface-variant/60">
                      Disease slug
                    </span>
                    <input
                      value={form.diseaseSlug}
                      onChange={(event) => setForm((current) => ({ ...current, diseaseSlug: event.target.value }))}
                      className="w-full rounded-xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/10"
                    />
                  </label>
                </div>

                <label className="space-y-1.5">
                  <span className="text-xs font-black uppercase tracking-[0.14em] text-on-surface-variant/60">
                    Ten benh
                  </span>
                  <input
                    value={form.diseaseName}
                    onChange={(event) => setForm((current) => ({ ...current, diseaseName: event.target.value }))}
                    className="w-full rounded-xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/10"
                  />
                </label>

                <div className="grid gap-4 md:grid-cols-3">
                  <label className="space-y-1.5">
                    <span className="text-xs font-black uppercase tracking-[0.14em] text-on-surface-variant/60">
                      Muc do
                    </span>
                    <select
                      value={form.severity}
                      onChange={(event) => setForm((current) => ({ ...current, severity: event.target.value as DiseaseForm['severity'] }))}
                      className="w-full rounded-xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none focus:border-primary/30"
                    >
                      <option value="low">Thap</option>
                      <option value="medium">Trung binh</option>
                      <option value="high">Cao</option>
                      <option value="critical">Rat cao</option>
                    </select>
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-black uppercase tracking-[0.14em] text-on-surface-variant/60">
                      Confidence threshold
                    </span>
                    <input
                      value={form.confidenceThreshold}
                      onChange={(event) => setForm((current) => ({ ...current, confidenceThreshold: event.target.value }))}
                      className="w-full rounded-xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/10"
                    />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-black uppercase tracking-[0.14em] text-on-surface-variant/60">
                      Trang thai
                    </span>
                    <select
                      value={form.isActive ? 'active' : 'inactive'}
                      onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.value === 'active' }))}
                      className="w-full rounded-xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none focus:border-primary/30"
                    >
                      <option value="active">Dang hoat dong</option>
                      <option value="inactive">Tam an</option>
                    </select>
                  </label>
                </div>

                {[
                  ['summary', 'Tom tat'],
                  ['symptoms', 'Trieu chung'],
                  ['causes', 'Nguyen nhan'],
                  ['treatmentGuidance', 'Huong xu ly'],
                  ['preventionGuidance', 'Huong phong ngua'],
                ].map(([key, label]) => (
                  <label key={key} className="space-y-1.5">
                    <span className="text-xs font-black uppercase tracking-[0.14em] text-on-surface-variant/60">
                      {label}
                    </span>
                    <textarea
                      rows={4}
                      value={form[key as keyof DiseaseForm] as string}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, [key]: event.target.value }))
                      }
                      className="w-full rounded-xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/10"
                    />
                  </label>
                ))}

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-1.5">
                    <span className="text-xs font-black uppercase tracking-[0.14em] text-on-surface-variant/60">
                      Hoat chat tham khao
                    </span>
                    <textarea
                      rows={5}
                      value={form.recommendedIngredientsText}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          recommendedIngredientsText: event.target.value,
                        }))
                      }
                      placeholder="Moi dong mot hoat chat"
                      className="w-full rounded-xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/10"
                    />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-black uppercase tracking-[0.14em] text-on-surface-variant/60">
                      Keyword fallback
                    </span>
                    <textarea
                      rows={5}
                      value={form.searchKeywordsText}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          searchKeywordsText: event.target.value,
                        }))
                      }
                      placeholder="Moi dong mot keyword tim san pham"
                      className="w-full rounded-xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/10"
                    />
                  </label>
                </div>
              </div>

              <div className="space-y-5">
                <div className="rounded-[1.75rem] border border-on-surface/8 p-5">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-on-surface-variant/60">
                    Tim san pham de map
                  </p>
                  <div className="relative mt-3">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50" />
                    <input
                      value={productSearch}
                      onChange={(event) => void searchProducts(event.target.value)}
                      placeholder="Tim theo ten san pham..."
                      className="w-full rounded-xl border border-on-surface/10 bg-surface py-3 pl-10 pr-4 text-sm outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/10"
                    />
                  </div>

                  <div className="mt-4 space-y-2">
                    {productLoading ? (
                      <div className="flex items-center justify-center py-6">
                        <LoaderCircle size={18} className="animate-spin text-primary" />
                      </div>
                    ) : productOptions.length === 0 ? (
                      <div className="rounded-2xl bg-surface px-4 py-6 text-sm text-on-surface-variant">
                        Nhap tu khoa de tim san pham.
                      </div>
                    ) : (
                      productOptions.map((product) => (
                        <div
                          key={product.productId}
                          className="flex items-center justify-between gap-3 rounded-2xl border border-on-surface/8 px-4 py-3"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-bold text-on-surface">{product.productName}</p>
                            <p className="text-xs text-on-surface-variant">
                              Ton kho {product.quantityAvailable} {product.unit ?? ''}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => addRecommendedProduct(product)}
                            className="rounded-full bg-primary px-3 py-1.5 text-xs font-black text-white transition hover:bg-primary/90"
                          >
                            Them
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-[1.75rem] border border-on-surface/8 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-on-surface-variant/60">
                      San pham da map
                    </p>
                    <span className="rounded-full bg-surface px-3 py-1 text-xs font-black text-on-surface">
                      {form.recommendedProducts.length}
                    </span>
                  </div>

                  <div className="mt-4 space-y-3">
                    {form.recommendedProducts.length === 0 ? (
                      <div className="rounded-2xl bg-surface px-4 py-6 text-sm text-on-surface-variant">
                        Chua co san pham nao duoc map. He thong se dung fallback keyword neu co.
                      </div>
                    ) : (
                      form.recommendedProducts.map((item, index) => (
                        <div
                          key={item.productId}
                          className="rounded-2xl border border-on-surface/8 px-4 py-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate font-bold text-on-surface">
                                {item.product?.productName ?? item.productId}
                              </p>
                              <p className="text-xs text-on-surface-variant">
                                Thu tu {index + 1}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeRecommendedProduct(item.productId)}
                              className="rounded-full border border-red-200 px-3 py-1 text-xs font-bold text-red-600 transition hover:bg-red-50"
                            >
                              Xoa
                            </button>
                          </div>

                          <label className="mt-3 flex items-center gap-2 text-xs font-bold text-on-surface-variant">
                            <input
                              type="checkbox"
                              checked={item.isPrimary}
                              onChange={(event) => {
                                const checked = event.target.checked;
                                setForm((current) => ({
                                  ...current,
                                  recommendedProducts: current.recommendedProducts.map((product) => ({
                                    ...product,
                                    isPrimary: product.productId === item.productId ? checked : false,
                                  })),
                                }));
                              }}
                            />
                            San pham uu tien
                          </label>

                          <div className="mt-3 grid gap-3">
                            <input
                              value={item.note}
                              onChange={(event) =>
                                updateRecommendedProduct(item.productId, {
                                  note: event.target.value,
                                })
                              }
                              placeholder="Ghi chu su dung"
                              className="w-full rounded-xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/10"
                            />
                            <input
                              value={item.rationale}
                              onChange={(event) =>
                                updateRecommendedProduct(item.productId, {
                                  rationale: event.target.value,
                                })
                              }
                              placeholder="Ly do de xuat"
                              className="w-full rounded-xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/10"
                            />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-on-surface/8 bg-white px-6 py-4">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-xl border border-on-surface/10 px-5 py-3 text-sm font-bold text-on-surface transition hover:bg-on-surface/5"
              >
                Dong
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-container px-5 py-3 text-sm font-black text-white shadow-xl shadow-primary/20 transition hover:-translate-y-0.5 disabled:opacity-60"
              >
                {saving ? (
                  <LoaderCircle size={16} className="animate-spin" />
                ) : (
                  <Save size={16} />
                )}
                Luu danh muc benh
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
