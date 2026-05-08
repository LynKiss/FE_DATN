import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  LoaderCircle,
  Minus,
  PackageX,
  Plus,
  RotateCcw,
  Save,
  Search,
  X,
} from 'lucide-react';
import { apiClient } from '../lib/api';
import { useLanguage } from '../i18n/language-context';
import { useToast } from '../hooks/useToast';

type Product = {
  productId: string;
  productName: string;
  quantityAvailable: number;
  unit: string | null;
  primaryImageUrl: string | null;
};

type OrderItem = {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: string;
  unit?: string | null;
  primaryImageUrl?: string | null;
};

type OrderDetail = {
  orderId: string;
  orderCode: string;
  customerName?: string | null;
  status: string;
  items: OrderItem[];
};

type ReturnLine = {
  productId: string;
  productName: string;
  maxQty: number;
  unit: string | null;
  quantity: number;
  returnReason: string;
  note: string;
};

type ReturnHistoryItem = {
  id: string;
  productName: string;
  quantityChange: number;
  note: string;
  relatedOrderId: string | null;
  createdAt: string;
};

type Tab = 'damage' | 'return';

const RETURN_REASONS = [
  'Hàng bị hỏng / vỡ khi vận chuyển',
  'Sản phẩm không đúng mô tả',
  'Giao sai sản phẩm',
  'Khách không nhận hàng',
  'Khách đổi ý',
  'Hàng bị lỗi / khuyết tật',
  'Lý do khác',
];

export default function ProductInventoryDamage() {
  const { language } = useLanguage();
  const isVietnamese = language === 'vi';
  const { showToast } = useToast();

  const [tab, setTab] = useState<Tab>('damage');

  // ── Damage tab state ─────────────────────────────────────────
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [damageQty, setDamageQty] = useState('1');
  const [damageNote, setDamageNote] = useState('');
  const [damageSaving, setDamageSaving] = useState(false);

  // ── Return tab state ──────────────────────────────────────────
  const [orderCode, setOrderCode] = useState('');
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderDetail, setOrderDetail] = useState<OrderDetail | null>(null);
  const [orderError, setOrderError] = useState('');
  const [returnLines, setReturnLines] = useState<ReturnLine[]>([]);
  const [returnSaving, setReturnSaving] = useState(false);
  const [returnHistory, setReturnHistory] = useState<ReturnHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Load product list for damage tab
  useEffect(() => {
    let cancelled = false;
    setProductsLoading(true);
    apiClient
      .get<{ items: Product[] }>('/products?includeHidden=true&page=1&limit=500')
      .then((d) => { if (!cancelled) setProducts(d.items ?? []); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setProductsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Load return history when switching to return tab
  useEffect(() => {
    if (tab !== 'return') return;
    let cancelled = false;
    setHistoryLoading(true);
    apiClient
      .get<{ items: Array<{ id: string; productName: string; quantityChange: number; note: string; relatedOrderId: string | null; createdAt: string }> }>(
        '/inventory/transactions?transactionType=return_in&limit=20',
      )
      .then((d) => {
        if (!cancelled) {
          setReturnHistory(
            (d.items ?? []).map((r) => ({
              id: r.id,
              productName: r.productName,
              quantityChange: r.quantityChange,
              note: r.note,
              relatedOrderId: r.relatedOrderId,
              createdAt: r.createdAt,
            })),
          );
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setHistoryLoading(false); });
    return () => { cancelled = true; };
  }, [tab]);

  const filteredProducts = useMemo(
    () => products.filter((p) => p.productName.toLowerCase().includes(search.trim().toLowerCase())),
    [products, search],
  );
  const selectedProduct = products.find((p) => p.productId === selectedProductId) ?? null;

  // ── Damage handlers ───────────────────────────────────────────
  async function handleDamageSubmit() {
    if (!selectedProductId || Number(damageQty) < 1) {
      showToast({ tone: 'error', title: 'Thiếu thông tin', description: 'Chọn sản phẩm và nhập số lượng.' });
      return;
    }
    if (selectedProduct && Number(damageQty) > selectedProduct.quantityAvailable) {
      showToast({ tone: 'error', title: 'Số lượng vượt tồn kho', description: `Tối đa ${selectedProduct.quantityAvailable} ${selectedProduct.unit ?? ''}` });
      return;
    }
    setDamageSaving(true);
    try {
      await apiClient.post('/inventory/transactions/damage', {
        productId: selectedProductId,
        quantity: Number(damageQty),
        note: damageNote.trim() || undefined,
      });
      showToast({ tone: 'success', title: 'Đã ghi nhận hàng hỏng', description: selectedProduct?.productName });
      setSelectedProductId('');
      setDamageQty('1');
      setDamageNote('');
    } catch (err) {
      showToast({ tone: 'error', title: 'Thao tác thất bại', description: err instanceof Error ? err.message : '' });
    } finally {
      setDamageSaving(false);
    }
  }

  // ── Return handlers ───────────────────────────────────────────
  const lookupOrder = useCallback(async () => {
    const code = orderCode.trim();
    if (!code) return;
    setOrderLoading(true);
    setOrderError('');
    setOrderDetail(null);
    setReturnLines([]);
    try {
      // Try to find by code first via orders list, then by id
      const list = await apiClient.get<{ items: Array<{ orderId: string; orderCode: string; customerName?: string | null; status: string }> }>(
        `/orders?search=${encodeURIComponent(code)}&limit=5`,
      );
      const match = (list.items ?? []).find(
        (o) => o.orderCode.toLowerCase() === code.toLowerCase() || o.orderId === code,
      );
      if (!match) {
        setOrderError('Không tìm thấy đơn hàng. Kiểm tra lại mã đơn hàng.');
        return;
      }
      const detail = await apiClient.get<{ orderId: string; orderCode: string; customerName?: string | null; status: string; items: OrderItem[] }>(
        `/orders/${match.orderId}`,
      );
      if (!detail.items?.length) {
        setOrderError('Đơn hàng không có sản phẩm.');
        return;
      }
      setOrderDetail(detail);
      setReturnLines(
        detail.items.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          maxQty: item.quantity,
          unit: item.unit ?? null,
          quantity: item.quantity,
          returnReason: RETURN_REASONS[0],
          note: '',
        })),
      );
    } catch {
      setOrderError('Không thể tải đơn hàng. Thử lại sau.');
    } finally {
      setOrderLoading(false);
    }
  }, [orderCode]);

  function updateLine(idx: number, field: keyof ReturnLine, value: string | number) {
    setReturnLines((prev) =>
      prev.map((line, i) => i === idx ? { ...line, [field]: value } : line),
    );
  }

  function removeLine(idx: number) {
    setReturnLines((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleReturnSubmit() {
    const activeLines = returnLines.filter((l) => l.quantity > 0);
    if (!activeLines.length) {
      showToast({ tone: 'error', title: 'Chưa có sản phẩm trả', description: 'Nhập số lượng cần trả cho ít nhất 1 sản phẩm.' });
      return;
    }
    setReturnSaving(true);
    let successCount = 0;
    let failCount = 0;
    for (const line of activeLines) {
      try {
        const noteText = `[${line.returnReason}]${line.note.trim() ? ' ' + line.note.trim() : ''}`;
        await apiClient.post('/inventory/transactions/return', {
          productId: line.productId,
          quantity: line.quantity,
          relatedOrderId: orderDetail?.orderId,
          note: noteText,
        });
        successCount++;
      } catch {
        failCount++;
      }
    }
    setReturnSaving(false);
    if (failCount === 0) {
      showToast({ tone: 'success', title: `Đã xử lý trả hàng ${successCount} sản phẩm`, description: `Đơn ${orderDetail?.orderCode ?? ''}` });
    } else {
      showToast({ tone: 'error', title: `${successCount} thành công, ${failCount} thất bại` });
    }
    setOrderCode('');
    setOrderDetail(null);
    setReturnLines([]);
    setOrderError('');
    // Reload history
    setHistoryLoading(true);
    apiClient
      .get<{ items: Array<{ id: string; productName: string; quantityChange: number; note: string; relatedOrderId: string | null; createdAt: string }> }>(
        '/inventory/transactions?transactionType=return_in&limit=20',
      )
      .then((d) => setReturnHistory((d.items ?? []).map((r) => ({ id: r.id, productName: r.productName, quantityChange: r.quantityChange, note: r.note, relatedOrderId: r.relatedOrderId, createdAt: r.createdAt }))))
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
  }

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="font-headline text-[2.7rem] font-black tracking-tight text-primary">
          {isVietnamese ? 'Hàng Hỏng / Trả Hàng' : 'Damage & Returns'}
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-on-surface-variant">
          {isVietnamese
            ? 'Ghi nhận hàng hư hỏng/hết hạn hoặc xử lý đơn trả hàng từ khách — tự động cập nhật tồn kho.'
            : 'Record damaged/expired goods or process customer returns — inventory is updated automatically.'}
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2 rounded-2xl border border-on-surface-variant/10 bg-surface p-1 w-fit">
        {(['damage', 'return'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-black transition-all ${
              tab === t ? 'bg-primary text-white shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            {t === 'damage' ? <PackageX size={16} /> : <RotateCcw size={16} />}
            {t === 'damage'
              ? isVietnamese ? 'Hàng hỏng / hết hạn' : 'Damaged / Expired'
              : isVietnamese ? 'Xử lý trả hàng' : 'Process returns'}
          </button>
        ))}
      </div>

      {/* ── DAMAGE TAB ── */}
      {tab === 'damage' && (
        <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
          {/* Product picker */}
          <section className="rounded-xl border border-on-surface-variant/5 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-black uppercase tracking-[0.2em] text-on-surface-variant/50">
              Chọn sản phẩm
            </h2>
            <div className="relative mb-4">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-2xl border border-on-surface/10 bg-surface py-3 pl-10 pr-4 text-sm outline-none"
                placeholder="Tìm sản phẩm..."
              />
            </div>
            <div className="max-h-[420px] overflow-y-auto space-y-2">
              {productsLoading ? (
                <div className="py-8 text-center"><LoaderCircle size={18} className="mx-auto animate-spin text-on-surface-variant" /></div>
              ) : filteredProducts.length === 0 ? (
                <p className="py-8 text-center text-sm text-on-surface-variant">Không tìm thấy sản phẩm</p>
              ) : filteredProducts.map((p) => (
                <button
                  key={p.productId}
                  type="button"
                  onClick={() => setSelectedProductId(p.productId)}
                  className={`w-full flex items-center gap-4 rounded-2xl border px-4 py-3 text-left transition-all ${
                    selectedProductId === p.productId
                      ? 'border-primary/30 bg-primary/5'
                      : 'border-on-surface-variant/5 hover:bg-on-surface-variant/[0.02]'
                  }`}
                >
                  {p.primaryImageUrl ? (
                    <img src={p.primaryImageUrl} alt="" className="h-12 w-12 rounded-xl object-cover shrink-0" />
                  ) : (
                    <div className="h-12 w-12 rounded-xl bg-primary/10 shrink-0 flex items-center justify-center">
                      <PackageX size={20} className="text-primary/50" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-bold text-on-surface truncate">{p.productName}</p>
                    <p className="mt-0.5 text-xs text-on-surface-variant/60">
                      Tồn kho:{' '}
                      <span className={p.quantityAvailable <= 5 ? 'text-red-500 font-bold' : 'text-emerald-600 font-bold'}>
                        {p.quantityAvailable}
                      </span>{' '}
                      {p.unit ?? ''}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Damage form */}
          <section className="rounded-xl border border-on-surface-variant/5 bg-white p-6 shadow-sm space-y-5">
            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-on-surface-variant/50">Thông tin hàng hỏng</h2>
            {selectedProduct ? (
              <div className="rounded-2xl bg-primary/5 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60">Sản phẩm đã chọn</p>
                <p className="mt-1 font-bold text-on-surface">{selectedProduct.productName}</p>
                <p className="mt-0.5 text-xs text-on-surface-variant/60">
                  Tồn kho hiện tại: {selectedProduct.quantityAvailable} {selectedProduct.unit ?? ''}
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-on-surface-variant/20 px-4 py-6 text-center text-sm text-on-surface-variant/50">
                Chưa chọn sản phẩm
              </div>
            )}

            <label className="grid gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50">Số lượng *</span>
              <input
                type="number" min="1"
                max={selectedProduct?.quantityAvailable ?? undefined}
                value={damageQty}
                onChange={(e) => setDamageQty(e.target.value)}
                className="input-base"
              />
              {selectedProduct && Number(damageQty) > selectedProduct.quantityAvailable && (
                <p className="flex items-center gap-1 text-xs text-red-500">
                  <AlertTriangle size={12} />
                  Vượt quá tồn kho ({selectedProduct.quantityAvailable})
                </p>
              )}
            </label>

            <label className="grid gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50">Lý do hỏng</span>
              <textarea
                value={damageNote}
                onChange={(e) => setDamageNote(e.target.value)}
                rows={3}
                className="input-base resize-none"
                placeholder="VD: Hàng bị vỡ khi vận chuyển, hàng hết hạn sử dụng..."
              />
            </label>

            <button
              type="button"
              onClick={() => void handleDamageSubmit()}
              disabled={damageSaving || !selectedProductId}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-black text-white disabled:opacity-50"
            >
              {damageSaving ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />}
              Ghi nhận hàng hỏng
            </button>
          </section>
        </div>
      )}

      {/* ── RETURN TAB ── */}
      {tab === 'return' && (
        <div className="space-y-6">
          {/* Step 1: Lookup order */}
          <section className="rounded-xl border border-on-surface-variant/5 bg-white p-6 shadow-sm">
            <h2 className="mb-1 text-base font-black text-on-surface">Bước 1 — Tra cứu đơn hàng</h2>
            <p className="mb-4 text-sm text-on-surface-variant">Nhập mã đơn hàng để tự động lấy danh sách sản phẩm cần trả.</p>
            <div className="flex gap-3">
              <input
                value={orderCode}
                onChange={(e) => { setOrderCode(e.target.value); setOrderError(''); setOrderDetail(null); setReturnLines([]); }}
                onKeyDown={(e) => { if (e.key === 'Enter') void lookupOrder(); }}
                placeholder="VD: ORD-20260425-1234"
                className="flex-1 rounded-2xl border border-on-surface/10 bg-surface px-4 py-2.5 text-sm outline-none focus:border-primary/40"
              />
              <button
                type="button"
                onClick={() => void lookupOrder()}
                disabled={!orderCode.trim() || orderLoading}
                className="flex items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50 hover:bg-primary/90"
              >
                {orderLoading ? <LoaderCircle size={15} className="animate-spin" /> : <Search size={15} />}
                Tìm đơn
              </button>
            </div>
            {orderError && (
              <p className="mt-3 flex items-center gap-2 rounded-2xl bg-red-50 px-4 py-2.5 text-sm text-red-600">
                <AlertTriangle size={15} /> {orderError}
              </p>
            )}
            {orderDetail && (
              <div className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 flex items-center gap-3">
                <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                <div>
                  <p className="font-bold text-on-surface">Đơn hàng: {orderDetail.orderCode}</p>
                  <p className="text-xs text-on-surface-variant">
                    {orderDetail.customerName ? `Khách: ${orderDetail.customerName} · ` : ''}
                    Trạng thái: <span className="font-semibold">{orderDetail.status}</span> · {orderDetail.items.length} sản phẩm
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* Step 2: Return lines */}
          {returnLines.length > 0 && (
            <section className="rounded-xl border border-on-surface-variant/5 bg-white p-6 shadow-sm space-y-5">
              <h2 className="text-base font-black text-on-surface">Bước 2 — Chọn sản phẩm & lý do trả</h2>
              <p className="text-sm text-on-surface-variant">Chỉnh số lượng về 0 nếu không trả mặt hàng đó. Mỗi dòng ghi một giao dịch trả riêng.</p>

              <div className="space-y-4">
                {returnLines.map((line, idx) => (
                  <div key={line.productId} className="rounded-2xl border border-on-surface/8 p-4 space-y-3">
                    {/* Product header */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold text-on-surface truncate">{line.productName}</p>
                        <p className="text-xs text-on-surface-variant/60">
                          Số lượng trong đơn: {line.maxQty} {line.unit ?? ''}
                        </p>
                      </div>
                      <button type="button" onClick={() => removeLine(idx)} className="rounded-xl p-1.5 text-on-surface-variant hover:bg-red-50 hover:text-red-500">
                        <X size={14} />
                      </button>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {/* Quantity stepper */}
                      <div>
                        <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50">
                          Số lượng trả *
                        </label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => updateLine(idx, 'quantity', Math.max(0, line.quantity - 1))}
                            className="flex h-9 w-9 items-center justify-center rounded-xl border border-on-surface/10 hover:bg-surface-variant"
                          >
                            <Minus size={14} />
                          </button>
                          <input
                            type="number" min="0" max={line.maxQty}
                            value={line.quantity}
                            onChange={(e) => updateLine(idx, 'quantity', Math.min(line.maxQty, Math.max(0, Number(e.target.value))))}
                            className="h-9 w-16 rounded-xl border border-on-surface/10 bg-surface text-center text-sm outline-none focus:border-primary/40"
                          />
                          <button
                            type="button"
                            onClick={() => updateLine(idx, 'quantity', Math.min(line.maxQty, line.quantity + 1))}
                            className="flex h-9 w-9 items-center justify-center rounded-xl border border-on-surface/10 hover:bg-surface-variant"
                          >
                            <Plus size={14} />
                          </button>
                          <span className="text-xs text-on-surface-variant">/ {line.maxQty} {line.unit ?? ''}</span>
                        </div>
                        {line.quantity > line.maxQty && (
                          <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
                            <AlertTriangle size={11} /> Vượt số lượng đơn hàng
                          </p>
                        )}
                      </div>

                      {/* Return reason */}
                      <div>
                        <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50">
                          Lý do trả *
                        </label>
                        <select
                          value={line.returnReason}
                          onChange={(e) => updateLine(idx, 'returnReason', e.target.value)}
                          className="w-full rounded-xl border border-on-surface/10 bg-surface px-3 py-2 text-sm outline-none focus:border-primary/40"
                        >
                          {RETURN_REASONS.map((r) => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Optional note */}
                    <div>
                      <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50">
                        Ghi chú thêm (tùy chọn)
                      </label>
                      <input
                        value={line.note}
                        onChange={(e) => updateLine(idx, 'note', e.target.value)}
                        placeholder="VD: Hộp bị bẹp, sản phẩm còn nguyên..."
                        className="w-full rounded-xl border border-on-surface/10 bg-surface px-3 py-2 text-sm outline-none focus:border-primary/40"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Summary & submit */}
              <div className="rounded-2xl bg-surface px-4 py-3 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-on-surface">
                    {returnLines.filter((l) => l.quantity > 0).length} sản phẩm sẽ được trả
                  </p>
                  <p className="text-xs text-on-surface-variant">
                    Tổng {returnLines.reduce((s, l) => s + (l.quantity > 0 ? l.quantity : 0), 0)} đơn vị · tồn kho sẽ được cộng lại tương ứng
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleReturnSubmit()}
                  disabled={returnSaving || returnLines.every((l) => l.quantity === 0)}
                  className="flex items-center gap-2 rounded-2xl bg-primary px-6 py-2.5 text-sm font-black text-white disabled:opacity-50 hover:bg-primary/90 whitespace-nowrap"
                >
                  {returnSaving ? <LoaderCircle size={15} className="animate-spin" /> : <Save size={15} />}
                  Xác nhận trả hàng
                </button>
              </div>
            </section>
          )}

          {/* Return history */}
          <section className="rounded-xl border border-on-surface-variant/5 bg-white shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              className="flex w-full items-center justify-between px-6 py-4 text-left hover:bg-surface/40"
            >
              <div className="flex items-center gap-2">
                <ClipboardList size={16} className="text-on-surface-variant" />
                <span className="text-sm font-black text-on-surface">Lịch sử trả hàng gần đây</span>
              </div>
              <span className="text-xs text-on-surface-variant">{showHistory ? 'Ẩn' : 'Xem'}</span>
            </button>

            {showHistory && (
              <div className="border-t border-on-surface/6">
                {historyLoading ? (
                  <div className="flex justify-center py-8">
                    <LoaderCircle size={20} className="animate-spin text-on-surface-variant" />
                  </div>
                ) : returnHistory.length === 0 ? (
                  <p className="py-8 text-center text-sm text-on-surface-variant">Chưa có lịch sử trả hàng</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-surface/60 text-[11px] font-black uppercase tracking-wider text-on-surface-variant/50">
                      <tr>
                        <th className="px-5 py-3 text-left">Sản phẩm</th>
                        <th className="px-5 py-3 text-left">SL trả</th>
                        <th className="px-5 py-3 text-left">Lý do</th>
                        <th className="px-5 py-3 text-left">Đơn hàng</th>
                        <th className="px-5 py-3 text-left">Thời gian</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-on-surface/5">
                      {returnHistory.map((r) => (
                        <tr key={r.id} className="hover:bg-surface/30">
                          <td className="px-5 py-3 font-medium text-on-surface">{r.productName}</td>
                          <td className="px-5 py-3 font-bold text-emerald-600">+{r.quantityChange}</td>
                          <td className="px-5 py-3 text-on-surface-variant max-w-[200px] truncate">{r.note}</td>
                          <td className="px-5 py-3 text-xs font-mono text-primary">{r.relatedOrderId ?? '—'}</td>
                          <td className="px-5 py-3 text-xs text-on-surface-variant">
                            {new Date(r.createdAt).toLocaleString('vi-VN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
