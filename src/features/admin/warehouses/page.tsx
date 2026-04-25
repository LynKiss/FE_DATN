import {
  ArrowRightLeft,
  ClipboardCheck,
  LoaderCircle,
  Package,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Star,
  Warehouse,
  X,
} from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { apiClient } from '../../../lib/api';
import { useToast } from '../../../hooks/useToast';

// ─── Types ────────────────────────────────────────────────────────────────────

type WarehouseT = {
  warehouseId: string;
  name: string;
  code: string | null;
  address: string | null;
  managerName: string | null;
  phone: string | null;
  isActive: boolean;
  isDefault: boolean;
};

type WarehouseStock = {
  warehouseId: string;
  productId: string;
  quantity: number;
  product?: { productName: string; unit: string | null };
};

type TransferStatus = 'draft' | 'shipping' | 'received' | 'cancelled';
type Transfer = {
  transferId: string;
  transferCode: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  status: TransferStatus;
  transferDate: string | null;
  notes: string | null;
  createdAt: string;
};
type TransferItem = { productId: string; qtyRequested: number; qtyReceived: number; notes: string | null };

type AdjustmentReason = 'damage' | 'loss' | 'inventory_count' | 'sample' | 'internal_use' | 'other';
type AdjustmentStatus = 'draft' | 'approved' | 'cancelled';
type Adjustment = {
  adjustmentId: string;
  adjustmentCode: string;
  warehouseId: string | null;
  reason: AdjustmentReason;
  status: AdjustmentStatus;
  adjustmentDate: string | null;
  notes: string | null;
  createdAt: string;
};
type AdjustmentItem = { productId: string; qtyBefore: number; qtyAfter: number; qtyDiff: number; notes: string | null };

type Product = { productId: string; productName: string; unit: string | null; quantityAvailable: number };
type Meta = { page: number; limit: number; total: number; totalPages: number };

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TRANSFER_STATUS_LABEL: Record<TransferStatus, string> = {
  draft: 'Nháp',
  shipping: 'Đang vận chuyển',
  received: 'Đã nhận',
  cancelled: 'Đã hủy',
};
const TRANSFER_STATUS_COLOR: Record<TransferStatus, string> = {
  draft: 'bg-slate-100 text-slate-600',
  shipping: 'bg-amber-100 text-amber-700',
  received: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-600',
};

const ADJ_STATUS_LABEL: Record<AdjustmentStatus, string> = { draft: 'Nháp', approved: 'Đã duyệt', cancelled: 'Đã hủy' };
const ADJ_STATUS_COLOR: Record<AdjustmentStatus, string> = {
  draft: 'bg-slate-100 text-slate-600',
  approved: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-600',
};

const ADJ_REASON_LABEL: Record<AdjustmentReason, string> = {
  damage: 'Hàng hỏng',
  loss: 'Thất thoát',
  inventory_count: 'Kiểm kho',
  sample: 'Lấy mẫu',
  internal_use: 'Sử dụng nội bộ',
  other: 'Khác',
};

const today = () => new Date().toISOString().slice(0, 10);

const inputCls = 'w-full rounded-xl border border-on-surface/10 bg-surface px-4 py-2.5 text-sm outline-none focus:border-primary/30';
const selectCls = 'w-full rounded-xl border border-on-surface/10 bg-surface px-4 py-2.5 text-sm outline-none focus:border-primary/30';

function FieldWrap({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs font-black uppercase tracking-[0.14em] text-on-surface-variant/60">{label}</span>
      {children}
    </label>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function WarehousesPage() {
  const { showToast } = useToast();
  const [tab, setTab] = useState<'warehouses' | 'stock' | 'transfers' | 'adjustments'>('warehouses');
  const [warehouses, setWarehouses] = useState<WarehouseT[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    void apiClient.get<WarehouseT[]>('/warehouses').then(setWarehouses);
    void apiClient.get<{ items: Product[] }>('/products?limit=500&includeHidden=true').then((d) =>
      setProducts(d.items ?? []),
    );
  }, []);

  function refreshWarehouses() {
    void apiClient.get<WarehouseT[]>('/warehouses').then(setWarehouses);
  }

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-4xl font-black tracking-tight text-primary">Kho hàng</h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          Quản lý kho, tồn kho, chuyển kho và điều chỉnh tồn kho.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 rounded-2xl border border-on-surface/8 bg-white p-1.5 shadow-sm w-fit">
        {(
          [
            { key: 'warehouses', label: 'Danh sách kho', icon: Warehouse },
            { key: 'stock', label: 'Tồn kho', icon: Package },
            { key: 'transfers', label: 'Chuyển kho', icon: ArrowRightLeft },
            { key: 'adjustments', label: 'Điều chỉnh kho', icon: ClipboardCheck },
          ] as const
        ).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
              tab === key
                ? 'bg-primary text-white shadow-md shadow-primary/20'
                : 'text-on-surface-variant hover:bg-surface'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {tab === 'warehouses' && (
        <WarehousesTab
          warehouses={warehouses}
          onRefresh={refreshWarehouses}
          showToast={showToast}
        />
      )}
      {tab === 'stock' && (
        <StockTab warehouses={warehouses} products={products} showToast={showToast} />
      )}
      {tab === 'transfers' && (
        <TransfersTab warehouses={warehouses} products={products} showToast={showToast} />
      )}
      {tab === 'adjustments' && (
        <AdjustmentsTab warehouses={warehouses} products={products} showToast={showToast} />
      )}
    </div>
  );
}

// ─── Warehouses Tab ───────────────────────────────────────────────────────────

function WarehousesTab({
  warehouses,
  onRefresh,
  showToast,
}: {
  warehouses: WarehouseT[];
  onRefresh: () => void;
  showToast: (o: { tone: 'success' | 'error'; title: string; description?: string }) => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', address: '', managerName: '', phone: '' });

  function openCreate() {
    setEditingId(null);
    setForm({ name: '', code: '', address: '', managerName: '', phone: '' });
    setModalOpen(true);
  }

  function openEdit(wh: WarehouseT) {
    setEditingId(wh.warehouseId);
    setForm({ name: wh.name, code: wh.code ?? '', address: wh.address ?? '', managerName: wh.managerName ?? '', phone: wh.phone ?? '' });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { showToast({ tone: 'error', title: 'Tên kho là bắt buộc' }); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim() || undefined,
        address: form.address.trim() || undefined,
        managerName: form.managerName.trim() || undefined,
        phone: form.phone.trim() || undefined,
      };
      if (editingId) {
        await apiClient.patch(`/warehouses/${editingId}`, payload);
        showToast({ tone: 'success', title: 'Đã cập nhật kho' });
      } else {
        await apiClient.post('/warehouses', payload);
        showToast({ tone: 'success', title: 'Đã thêm kho mới' });
      }
      setModalOpen(false);
      onRefresh();
    } catch (err) {
      showToast({ tone: 'error', title: 'Lưu thất bại', description: err instanceof Error ? err.message : '' });
    } finally {
      setSaving(false);
    }
  }

  async function handleSetDefault(id: string) {
    try {
      await apiClient.patch(`/warehouses/${id}/set-default`, {});
      showToast({ tone: 'success', title: 'Đã đặt kho mặc định' });
      onRefresh();
    } catch (err) {
      showToast({ tone: 'error', title: 'Thất bại', description: err instanceof Error ? err.message : '' });
    }
  }

  return (
    <>
      <div className="flex justify-end">
        <button type="button" onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-black text-white shadow-lg shadow-primary/20 transition hover:-translate-y-0.5">
          <Plus size={15} /> Thêm kho
        </button>
      </div>

      <section className="overflow-hidden rounded-[2rem] border border-on-surface/8 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-on-surface/8 bg-surface/70 text-[11px] font-black uppercase tracking-[0.18em] text-on-surface-variant/60">
              <tr>
                <th className="px-5 py-4">Tên kho</th>
                <th className="px-5 py-4">Địa chỉ</th>
                <th className="px-5 py-4">Quản lý</th>
                <th className="px-5 py-4">Trạng thái</th>
                <th className="px-5 py-4 text-center">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-on-surface/6">
              {warehouses.length === 0 ? (
                <tr><td colSpan={5} className="py-16 text-center text-on-surface-variant">
                  <Warehouse size={28} className="mx-auto mb-3 text-primary/30" />Chưa có kho nào
                </td></tr>
              ) : warehouses.map((wh) => (
                <tr key={wh.warehouseId} className="hover:bg-surface/40">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-on-surface">{wh.name}</p>
                      {wh.isDefault && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-700">
                          <Star size={9} />Mặc định
                        </span>
                      )}
                    </div>
                    {wh.code && <p className="text-xs text-on-surface-variant/60">{wh.code}</p>}
                  </td>
                  <td className="px-5 py-3.5 text-on-surface-variant">{wh.address ?? '—'}</td>
                  <td className="px-5 py-3.5 text-on-surface-variant">
                    <p>{wh.managerName ?? '—'}</p>
                    {wh.phone && <p className="text-xs">{wh.phone}</p>}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold ${wh.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                      {wh.isActive ? 'Hoạt động' : 'Tạm ngừng'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-center gap-1">
                      <button type="button" onClick={() => openEdit(wh)}
                        className="rounded-xl border border-primary/20 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/8">
                        Sửa
                      </button>
                      {!wh.isDefault && (
                        <button type="button" onClick={() => void handleSetDefault(wh.warehouseId)}
                          className="rounded-xl border border-amber-200 px-3 py-1.5 text-xs font-bold text-amber-700 hover:bg-amber-50">
                          Đặt mặc định
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-lg overflow-y-auto rounded-[2rem] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-on-surface/8 px-6 py-5">
              <h2 className="text-xl font-black">{editingId ? 'Cập nhật kho' : 'Thêm kho mới'}</h2>
              <button type="button" onClick={() => setModalOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full border border-on-surface/10 hover:bg-on-surface/5">
                <X size={17} />
              </button>
            </div>
            <div className="space-y-4 px-6 py-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldWrap label="Tên kho *">
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
                </FieldWrap>
                <FieldWrap label="Mã kho">
                  <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className={inputCls} />
                </FieldWrap>
              </div>
              <FieldWrap label="Địa chỉ">
                <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={inputCls} />
              </FieldWrap>
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldWrap label="Quản lý kho">
                  <input value={form.managerName} onChange={(e) => setForm({ ...form, managerName: e.target.value })} className={inputCls} />
                </FieldWrap>
                <FieldWrap label="Số điện thoại">
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputCls} />
                </FieldWrap>
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-on-surface/8 px-6 py-4">
              <button type="button" onClick={() => setModalOpen(false)} className="rounded-xl border border-on-surface/10 px-5 py-2.5 text-sm font-bold hover:bg-on-surface/5">Đóng</button>
              <button type="button" onClick={() => void handleSave()} disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-primary/20 disabled:opacity-60">
                {saving && <LoaderCircle size={15} className="animate-spin" />}Lưu
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Stock Tab ────────────────────────────────────────────────────────────────

function StockTab({
  warehouses,
  products,
  showToast,
}: {
  warehouses: WarehouseT[];
  products: Product[];
  showToast: (o: { tone: 'success' | 'error'; title: string }) => void;
}) {
  const [whId, setWhId] = useState('');
  const [stock, setStock] = useState<WarehouseStock[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (warehouses.length && !whId) {
      const def = warehouses.find((w) => w.isDefault) ?? warehouses[0];
      setWhId(def.warehouseId);
    }
  }, [warehouses]);

  useEffect(() => {
    if (!whId) return;
    setLoading(true);
    void apiClient.get<WarehouseStock[]>(`/warehouses/${whId}/stock`)
      .then(setStock)
      .finally(() => setLoading(false));
  }, [whId]);

  const filtered = search.trim()
    ? stock.filter((s) => {
        const prod = products.find((p) => p.productId === s.productId);
        return prod?.productName.toLowerCase().includes(search.toLowerCase());
      })
    : stock;

  return (
    <>
      <section className="rounded-[2rem] border border-on-surface/8 bg-white p-5 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-[200px_1fr_auto]">
          <select value={whId} onChange={(e) => setWhId(e.target.value)} className="rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none">
            {warehouses.map((w) => (
              <option key={w.warehouseId} value={w.warehouseId}>{w.name}{w.isDefault ? ' (mặc định)' : ''}</option>
            ))}
          </select>
          <label className="relative">
            <Search size={15} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm sản phẩm..."
              className="w-full rounded-2xl border border-on-surface/10 bg-surface py-3 pl-11 pr-4 text-sm outline-none focus:border-primary/40" />
          </label>
          <button type="button" onClick={() => { setLoading(true); void apiClient.get<WarehouseStock[]>(`/warehouses/${whId}/stock`).then(setStock).finally(() => setLoading(false)); }}
            className="inline-flex items-center gap-2 rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm font-semibold text-on-surface-variant hover:text-primary">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Làm mới
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-[2rem] border border-on-surface/8 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-on-surface/8 bg-surface/70 text-[11px] font-black uppercase tracking-[0.18em] text-on-surface-variant/60">
              <tr>
                <th className="px-5 py-4">Sản phẩm</th>
                <th className="px-5 py-4 text-right">SL trong kho</th>
                <th className="px-5 py-4 text-right">SL tổng hệ thống</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-on-surface/6">
              {loading ? (
                <tr><td colSpan={3} className="py-16 text-center"><LoaderCircle size={18} className="mx-auto animate-spin text-primary" /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={3} className="py-16 text-center text-on-surface-variant">
                  <Package size={28} className="mx-auto mb-3 text-primary/30" />Kho trống hoặc không có dữ liệu
                </td></tr>
              ) : filtered.map((s) => {
                const prod = products.find((p) => p.productId === s.productId);
                return (
                  <tr key={s.productId} className="hover:bg-surface/40">
                    <td className="px-5 py-3.5 font-semibold text-on-surface">
                      {prod?.productName ?? s.productId}
                      {prod?.unit && <span className="ml-2 text-xs text-on-surface-variant/60">({prod.unit})</span>}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className={`font-bold ${s.quantity === 0 ? 'text-red-500' : s.quantity < 10 ? 'text-amber-600' : 'text-on-surface'}`}>
                        {s.quantity.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right text-on-surface-variant">{prod?.quantityAvailable.toLocaleString() ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="border-t border-on-surface/8 px-5 py-3 text-xs text-on-surface-variant">
            {filtered.length} mặt hàng · Tổng tồn: {filtered.reduce((s, i) => s + i.quantity, 0).toLocaleString()}
          </div>
        )}
      </section>
    </>
  );
}

// ─── Transfers Tab ────────────────────────────────────────────────────────────

function TransfersTab({
  warehouses,
  products,
  showToast,
}: {
  warehouses: WarehouseT[];
  products: Product[];
  showToast: (o: { tone: 'success' | 'error'; title: string; description?: string }) => void;
}) {
  const [items, setItems] = useState<Transfer[]>([]);
  const [meta, setMeta] = useState<Meta>({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<(Transfer & { items: TransferItem[] }) | null>(null);
  const [saving, setSaving] = useState(false);
  const [receiveModalId, setReceiveModalId] = useState<string | null>(null);
  const [receiveDetail, setReceiveDetail] = useState<(Transfer & { items: TransferItem[] }) | null>(null);
  const [receiveQtys, setReceiveQtys] = useState<Record<string, number>>({});

  // Form
  const [fromWhId, setFromWhId] = useState('');
  const [toWhId, setToWhId] = useState('');
  const [transferDate, setTransferDate] = useState(today());
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<{ productId: string; qtyRequested: number; notes: string }[]>([
    { productId: '', qtyRequested: 1, notes: '' },
  ]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const q = new URLSearchParams({ page: String(page), limit: '20', status: statusFilter });
    void apiClient
      .get<{ items: Transfer[]; meta: Meta }>(`/warehouses/transfers/list?${q}`)
      .then((d) => { if (!cancelled) { setItems(d.items); setMeta(d.meta); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [statusFilter, page, reloadKey]);

  useEffect(() => {
    if (!detailId) { setDetail(null); return; }
    void apiClient.get<Transfer & { items: TransferItem[] }>(`/warehouses/transfers/${detailId}`).then(setDetail);
  }, [detailId]);

  async function handleSave() {
    if (!fromWhId || !toWhId) { showToast({ tone: 'error', title: 'Chọn kho nguồn và kho đích' }); return; }
    if (fromWhId === toWhId) { showToast({ tone: 'error', title: 'Kho nguồn và kho đích không được giống nhau' }); return; }
    if (lines.some((l) => !l.productId || l.qtyRequested < 1)) {
      showToast({ tone: 'error', title: 'Điền đầy đủ thông tin dòng hàng' });
      return;
    }
    setSaving(true);
    try {
      await apiClient.post('/warehouses/transfers', {
        fromWarehouseId: fromWhId,
        toWarehouseId: toWhId,
        transferDate,
        notes: notes || undefined,
        items: lines.map((l) => ({ productId: l.productId, qtyRequested: l.qtyRequested, notes: l.notes || undefined })),
      });
      showToast({ tone: 'success', title: 'Đã tạo phiếu chuyển kho' });
      setModalOpen(false);
      setReloadKey((k) => k + 1);
    } catch (err) {
      showToast({ tone: 'error', title: 'Lưu thất bại', description: err instanceof Error ? err.message : '' });
    } finally {
      setSaving(false);
    }
  }

  async function handleShip(id: string) {
    try {
      await apiClient.patch(`/warehouses/transfers/${id}/ship`, {});
      showToast({ tone: 'success', title: 'Đã xuất kho, đang vận chuyển' });
      setReloadKey((k) => k + 1);
      if (detailId === id) setDetailId(id);
    } catch (err) {
      showToast({ tone: 'error', title: 'Thất bại', description: err instanceof Error ? err.message : '' });
    }
  }

  async function openReceiveModal(id: string) {
    const t = await apiClient.get<Transfer & { items: TransferItem[] }>(`/warehouses/transfers/${id}`);
    setReceiveDetail(t);
    const initial: Record<string, number> = {};
    t.items.forEach((item) => { initial[item.productId] = item.qtyRequested; });
    setReceiveQtys(initial);
    setReceiveModalId(id);
  }

  async function handleReceive() {
    if (!receiveModalId || !receiveDetail) return;
    try {
      await apiClient.patch(`/warehouses/transfers/${receiveModalId}/receive`, {
        items: receiveDetail.items.map((item) => ({
          productId: item.productId,
          qtyReceived: receiveQtys[item.productId] ?? item.qtyRequested,
        })),
      });
      showToast({ tone: 'success', title: 'Đã nhận hàng, tồn kho đã cập nhật' });
      setReceiveModalId(null);
      setReloadKey((k) => k + 1);
    } catch (err) {
      showToast({ tone: 'error', title: 'Thất bại', description: err instanceof Error ? err.message : '' });
    }
  }

  return (
    <>
      <section className="rounded-[2rem] border border-on-surface/8 bg-white p-5 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-[200px_auto_auto]">
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none">
            <option value="all">Tất cả trạng thái</option>
            {(Object.keys(TRANSFER_STATUS_LABEL) as TransferStatus[]).map((s) => (
              <option key={s} value={s}>{TRANSFER_STATUS_LABEL[s]}</option>
            ))}
          </select>
          <button type="button" onClick={() => setReloadKey((k) => k + 1)} disabled={loading}
            className="inline-flex items-center gap-2 rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm font-semibold text-on-surface-variant hover:text-primary disabled:opacity-50">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />Làm mới
          </button>
          <button type="button" onClick={() => {
            setFromWhId(''); setToWhId(''); setTransferDate(today()); setNotes('');
            setLines([{ productId: '', qtyRequested: 1, notes: '' }]);
            setModalOpen(true);
          }}
            className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-black text-white shadow-lg shadow-primary/20 hover:-translate-y-0.5 transition">
            <Plus size={15} />Tạo phiếu chuyển kho
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-[2rem] border border-on-surface/8 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-on-surface/8 bg-surface/70 text-[11px] font-black uppercase tracking-[0.18em] text-on-surface-variant/60">
              <tr>
                <th className="px-5 py-4">Mã phiếu</th>
                <th className="px-5 py-4">Kho nguồn</th>
                <th className="px-5 py-4">Kho đích</th>
                <th className="px-5 py-4">Ngày</th>
                <th className="px-5 py-4">Trạng thái</th>
                <th className="px-5 py-4 text-center">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-on-surface/6">
              {loading ? (
                <tr><td colSpan={6} className="py-16 text-center"><LoaderCircle size={18} className="mx-auto animate-spin text-primary" /></td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={6} className="py-16 text-center text-on-surface-variant">
                  <ArrowRightLeft size={28} className="mx-auto mb-3 text-primary/30" />Chưa có phiếu chuyển kho
                </td></tr>
              ) : items.map((t) => {
                const fromWh = warehouses.find((w) => w.warehouseId === t.fromWarehouseId);
                const toWh = warehouses.find((w) => w.warehouseId === t.toWarehouseId);
                return (
                  <tr key={t.transferId} className="hover:bg-surface/40">
                    <td className="px-5 py-3.5 font-bold">{t.transferCode}</td>
                    <td className="px-5 py-3.5 text-on-surface-variant">{fromWh?.name ?? t.fromWarehouseId}</td>
                    <td className="px-5 py-3.5 text-on-surface-variant">{toWh?.name ?? t.toWarehouseId}</td>
                    <td className="px-5 py-3.5 text-on-surface-variant">{t.transferDate ? new Date(t.transferDate).toLocaleDateString('vi-VN') : '—'}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold ${TRANSFER_STATUS_COLOR[t.status]}`}>
                        {TRANSFER_STATUS_LABEL[t.status]}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-center gap-1">
                        <button type="button" onClick={() => setDetailId(detailId === t.transferId ? null : t.transferId)}
                          className="rounded-xl border border-primary/20 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/8">
                          {detailId === t.transferId ? 'Đóng' : 'Chi tiết'}
                        </button>
                        {t.status === 'draft' && (
                          <button type="button" onClick={() => void handleShip(t.transferId)}
                            className="rounded-xl border border-amber-200 px-3 py-1.5 text-xs font-bold text-amber-700 hover:bg-amber-50">
                            Xuất kho
                          </button>
                        )}
                        {t.status === 'shipping' && (
                          <button type="button" onClick={() => void openReceiveModal(t.transferId)}
                            className="rounded-xl border border-emerald-200 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-50">
                            Nhận hàng
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {detailId && detail && (
          <div className="border-t border-on-surface/8 bg-surface/40 px-6 py-5">
            <p className="mb-3 text-xs font-black uppercase tracking-widest text-on-surface-variant/50">Chi tiết — {detail.transferCode}</p>
            <table className="min-w-full text-sm">
              <thead className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant/50">
                <tr>
                  <th className="pb-2 pr-6 text-left">Sản phẩm</th>
                  <th className="pb-2 pr-6 text-right">SL yêu cầu</th>
                  <th className="pb-2 text-right">SL đã nhận</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-on-surface/6">
                {detail.items.map((item, idx) => {
                  const prod = products.find((p) => p.productId === item.productId);
                  return (
                    <tr key={idx}>
                      <td className="py-2 pr-6">{prod?.productName ?? item.productId}</td>
                      <td className="py-2 pr-6 text-right">{item.qtyRequested}</td>
                      <td className="py-2 text-right font-semibold">{item.qtyReceived}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {detail.notes && <p className="mt-3 text-sm text-on-surface-variant">Ghi chú: {detail.notes}</p>}
          </div>
        )}

        {meta.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-on-surface/8 px-5 py-4 text-sm text-on-surface-variant">
            <span>Tổng {meta.total} phiếu</span>
            <div className="flex gap-1">
              {Array.from({ length: meta.totalPages }, (_, i) => i + 1).map((p) => (
                <button key={p} type="button" onClick={() => setPage(p)}
                  className={`h-8 w-8 rounded-lg text-xs font-bold transition ${p === page ? 'bg-primary text-white' : 'hover:bg-surface'}`}>{p}</button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Create Transfer Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/50 p-4 pt-8">
          <div className="w-full max-w-2xl overflow-y-auto rounded-[2rem] bg-white shadow-2xl" style={{ maxHeight: '90vh' }}>
            <div className="sticky top-0 flex items-center justify-between border-b border-on-surface/8 bg-white px-6 py-5">
              <h2 className="text-xl font-black">Tạo phiếu chuyển kho</h2>
              <button type="button" onClick={() => setModalOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full border border-on-surface/10 hover:bg-on-surface/5">
                <X size={17} />
              </button>
            </div>
            <div className="space-y-5 px-6 py-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldWrap label="Kho nguồn *">
                  <select value={fromWhId} onChange={(e) => setFromWhId(e.target.value)} className={selectCls}>
                    <option value="">— Chọn kho —</option>
                    {warehouses.map((w) => <option key={w.warehouseId} value={w.warehouseId}>{w.name}</option>)}
                  </select>
                </FieldWrap>
                <FieldWrap label="Kho đích *">
                  <select value={toWhId} onChange={(e) => setToWhId(e.target.value)} className={selectCls}>
                    <option value="">— Chọn kho —</option>
                    {warehouses.filter((w) => w.warehouseId !== fromWhId).map((w) => (
                      <option key={w.warehouseId} value={w.warehouseId}>{w.name}</option>
                    ))}
                  </select>
                </FieldWrap>
              </div>
              <FieldWrap label="Ngày chuyển">
                <input type="date" value={transferDate} onChange={(e) => setTransferDate(e.target.value)} className={inputCls} />
              </FieldWrap>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-[0.14em] text-on-surface-variant/60">Dòng hàng</span>
                  <button type="button" onClick={() => setLines((p) => [...p, { productId: '', qtyRequested: 1, notes: '' }])}
                    className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline">
                    <Plus size={13} /> Thêm dòng
                  </button>
                </div>
                <div className="space-y-2">
                  {lines.map((line, idx) => (
                    <div key={idx} className="grid gap-2 sm:grid-cols-[1fr_80px_32px]">
                      <select value={line.productId} onChange={(e) => setLines((p) => p.map((l, i) => i === idx ? { ...l, productId: e.target.value } : l))} className={selectCls}>
                        <option value="">— Sản phẩm —</option>
                        {products.map((p) => <option key={p.productId} value={p.productId}>{p.productName}</option>)}
                      </select>
                      <input type="number" min={1} placeholder="SL" value={line.qtyRequested}
                        onChange={(e) => setLines((p) => p.map((l, i) => i === idx ? { ...l, qtyRequested: Number(e.target.value) } : l))}
                        className={inputCls} />
                      <button type="button" disabled={lines.length === 1}
                        onClick={() => setLines((p) => p.filter((_, i) => i !== idx))}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant/40 hover:text-red-500 disabled:opacity-30">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <FieldWrap label="Ghi chú">
                <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} />
              </FieldWrap>
            </div>
            <div className="sticky bottom-0 flex justify-end gap-3 border-t border-on-surface/8 bg-white px-6 py-4">
              <button type="button" onClick={() => setModalOpen(false)} className="rounded-xl border border-on-surface/10 px-5 py-2.5 text-sm font-bold hover:bg-on-surface/5">Đóng</button>
              <button type="button" onClick={() => void handleSave()} disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-primary/20 disabled:opacity-60">
                {saving && <LoaderCircle size={15} className="animate-spin" />}Lưu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receive Modal */}
      {receiveModalId && receiveDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-lg overflow-y-auto rounded-[2rem] bg-white shadow-2xl" style={{ maxHeight: '80vh' }}>
            <div className="flex items-center justify-between border-b border-on-surface/8 px-6 py-5">
              <h2 className="text-xl font-black">Nhận hàng — {receiveDetail.transferCode}</h2>
              <button type="button" onClick={() => setReceiveModalId(null)} className="flex h-9 w-9 items-center justify-center rounded-full border border-on-surface/10 hover:bg-on-surface/5">
                <X size={17} />
              </button>
            </div>
            <div className="space-y-3 px-6 py-6">
              {receiveDetail.items.map((item) => {
                const prod = products.find((p) => p.productId === item.productId);
                return (
                  <div key={item.productId} className="grid grid-cols-[1fr_120px] items-center gap-4">
                    <p className="text-sm font-semibold">{prod?.productName ?? item.productId}
                      <span className="ml-2 text-xs text-on-surface-variant/60">Yêu cầu: {item.qtyRequested}</span>
                    </p>
                    <label className="space-y-1">
                      <span className="text-[10px] uppercase tracking-wide font-black text-on-surface-variant/50">SL thực nhận</span>
                      <input type="number" min={0} max={item.qtyRequested} value={receiveQtys[item.productId] ?? item.qtyRequested}
                        onChange={(e) => setReceiveQtys((q) => ({ ...q, [item.productId]: Number(e.target.value) }))}
                        className={inputCls} />
                    </label>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end gap-3 border-t border-on-surface/8 px-6 py-4">
              <button type="button" onClick={() => setReceiveModalId(null)} className="rounded-xl border border-on-surface/10 px-5 py-2.5 text-sm font-bold hover:bg-on-surface/5">Đóng</button>
              <button type="button" onClick={() => void handleReceive()}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white shadow disabled:opacity-60">
                Xác nhận nhận hàng
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Adjustments Tab ──────────────────────────────────────────────────────────

function AdjustmentsTab({
  warehouses,
  products,
  showToast,
}: {
  warehouses: WarehouseT[];
  products: Product[];
  showToast: (o: { tone: 'success' | 'error'; title: string; description?: string }) => void;
}) {
  const [items, setItems] = useState<Adjustment[]>([]);
  const [meta, setMeta] = useState<Meta>({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<(Adjustment & { items: AdjustmentItem[] }) | null>(null);
  const [saving, setSaving] = useState(false);

  // Form
  const [whId, setWhId] = useState('');
  const [reason, setReason] = useState<AdjustmentReason>('inventory_count');
  const [adjDate, setAdjDate] = useState(today());
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<{ productId: string; qtyBefore: number; qtyAfter: number; notes: string }[]>([
    { productId: '', qtyBefore: 0, qtyAfter: 0, notes: '' },
  ]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const q = new URLSearchParams({ page: String(page), limit: '20', status: statusFilter });
    void apiClient
      .get<{ items: Adjustment[]; meta: Meta }>(`/warehouses/adjustments/list?${q}`)
      .then((d) => { if (!cancelled) { setItems(d.items); setMeta(d.meta); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [statusFilter, page, reloadKey]);

  useEffect(() => {
    if (!detailId) { setDetail(null); return; }
    void apiClient.get<Adjustment & { items: AdjustmentItem[] }>(`/warehouses/adjustments/${detailId}`).then(setDetail);
  }, [detailId]);

  // Auto-fill qtyBefore from product's quantityAvailable
  function handleProductChange(idx: number, productId: string) {
    const prod = products.find((p) => p.productId === productId);
    setLines((prev) => prev.map((l, i) => i === idx ? { ...l, productId, qtyBefore: prod?.quantityAvailable ?? 0, qtyAfter: prod?.quantityAvailable ?? 0 } : l));
  }

  async function handleSave() {
    if (lines.some((l) => !l.productId)) {
      showToast({ tone: 'error', title: 'Điền đủ thông tin dòng hàng' });
      return;
    }
    setSaving(true);
    try {
      await apiClient.post('/warehouses/adjustments', {
        warehouseId: whId || undefined,
        reason,
        adjustmentDate: adjDate,
        notes: notes || undefined,
        items: lines.map((l) => ({
          productId: l.productId,
          qtyBefore: l.qtyBefore,
          qtyAfter: l.qtyAfter,
          notes: l.notes || undefined,
        })),
      });
      showToast({ tone: 'success', title: 'Đã tạo phiếu điều chỉnh kho' });
      setModalOpen(false);
      setReloadKey((k) => k + 1);
    } catch (err) {
      showToast({ tone: 'error', title: 'Lưu thất bại', description: err instanceof Error ? err.message : '' });
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove(id: string) {
    try {
      await apiClient.patch(`/warehouses/adjustments/${id}/approve`, {});
      showToast({ tone: 'success', title: 'Đã duyệt, tồn kho đã cập nhật' });
      setReloadKey((k) => k + 1);
      if (detailId === id) setDetailId(id);
    } catch (err) {
      showToast({ tone: 'error', title: 'Thất bại', description: err instanceof Error ? err.message : '' });
    }
  }

  async function handleCancel(id: string) {
    try {
      await apiClient.patch(`/warehouses/adjustments/${id}/cancel`, {});
      showToast({ tone: 'success', title: 'Đã hủy phiếu điều chỉnh' });
      setReloadKey((k) => k + 1);
    } catch (err) {
      showToast({ tone: 'error', title: 'Thất bại', description: err instanceof Error ? err.message : '' });
    }
  }

  return (
    <>
      <section className="rounded-[2rem] border border-on-surface/8 bg-white p-5 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-[200px_auto_auto]">
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none">
            <option value="all">Tất cả trạng thái</option>
            {(Object.keys(ADJ_STATUS_LABEL) as AdjustmentStatus[]).map((s) => (
              <option key={s} value={s}>{ADJ_STATUS_LABEL[s]}</option>
            ))}
          </select>
          <button type="button" onClick={() => setReloadKey((k) => k + 1)} disabled={loading}
            className="inline-flex items-center gap-2 rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm font-semibold text-on-surface-variant hover:text-primary disabled:opacity-50">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />Làm mới
          </button>
          <button type="button" onClick={() => {
            setWhId(''); setReason('inventory_count'); setAdjDate(today()); setNotes('');
            setLines([{ productId: '', qtyBefore: 0, qtyAfter: 0, notes: '' }]);
            setModalOpen(true);
          }}
            className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-black text-white shadow-lg shadow-primary/20 hover:-translate-y-0.5 transition">
            <Plus size={15} />Tạo phiếu điều chỉnh
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-[2rem] border border-on-surface/8 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-on-surface/8 bg-surface/70 text-[11px] font-black uppercase tracking-[0.18em] text-on-surface-variant/60">
              <tr>
                <th className="px-5 py-4">Mã phiếu</th>
                <th className="px-5 py-4">Kho</th>
                <th className="px-5 py-4">Lý do</th>
                <th className="px-5 py-4">Ngày điều chỉnh</th>
                <th className="px-5 py-4">Trạng thái</th>
                <th className="px-5 py-4 text-center">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-on-surface/6">
              {loading ? (
                <tr><td colSpan={6} className="py-16 text-center"><LoaderCircle size={18} className="mx-auto animate-spin text-primary" /></td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={6} className="py-16 text-center text-on-surface-variant">
                  <ClipboardCheck size={28} className="mx-auto mb-3 text-primary/30" />Chưa có phiếu điều chỉnh
                </td></tr>
              ) : items.map((adj) => {
                const wh = warehouses.find((w) => w.warehouseId === adj.warehouseId);
                return (
                  <tr key={adj.adjustmentId} className="hover:bg-surface/40">
                    <td className="px-5 py-3.5 font-bold">{adj.adjustmentCode}</td>
                    <td className="px-5 py-3.5 text-on-surface-variant">{wh?.name ?? (adj.warehouseId ? adj.warehouseId : '—')}</td>
                    <td className="px-5 py-3.5 text-on-surface-variant">{ADJ_REASON_LABEL[adj.reason]}</td>
                    <td className="px-5 py-3.5 text-on-surface-variant">{adj.adjustmentDate ? new Date(adj.adjustmentDate).toLocaleDateString('vi-VN') : '—'}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold ${ADJ_STATUS_COLOR[adj.status]}`}>
                        {ADJ_STATUS_LABEL[adj.status]}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-center gap-1">
                        <button type="button" onClick={() => setDetailId(detailId === adj.adjustmentId ? null : adj.adjustmentId)}
                          className="rounded-xl border border-primary/20 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/8">
                          {detailId === adj.adjustmentId ? 'Đóng' : 'Chi tiết'}
                        </button>
                        {adj.status === 'draft' && (
                          <>
                            <button type="button" onClick={() => void handleApprove(adj.adjustmentId)}
                              className="rounded-xl border border-emerald-200 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-50">
                              Duyệt
                            </button>
                            <button type="button" onClick={() => void handleCancel(adj.adjustmentId)}
                              className="rounded-xl border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50">
                              Hủy
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {detailId && detail && (
          <div className="border-t border-on-surface/8 bg-surface/40 px-6 py-5">
            <p className="mb-3 text-xs font-black uppercase tracking-widest text-on-surface-variant/50">Chi tiết — {detail.adjustmentCode}</p>
            <table className="min-w-full text-sm">
              <thead className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant/50">
                <tr>
                  <th className="pb-2 pr-6 text-left">Sản phẩm</th>
                  <th className="pb-2 pr-6 text-right">SL trước</th>
                  <th className="pb-2 pr-6 text-right">SL sau</th>
                  <th className="pb-2 text-right">Chênh lệch</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-on-surface/6">
                {detail.items.map((item, idx) => {
                  const prod = products.find((p) => p.productId === item.productId);
                  return (
                    <tr key={idx}>
                      <td className="py-2 pr-6">{prod?.productName ?? item.productId}</td>
                      <td className="py-2 pr-6 text-right">{item.qtyBefore}</td>
                      <td className="py-2 pr-6 text-right">{item.qtyAfter}</td>
                      <td className={`py-2 text-right font-bold ${item.qtyDiff > 0 ? 'text-emerald-600' : item.qtyDiff < 0 ? 'text-red-500' : 'text-on-surface-variant'}`}>
                        {item.qtyDiff > 0 ? '+' : ''}{item.qtyDiff}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {detail.notes && <p className="mt-3 text-sm text-on-surface-variant">Ghi chú: {detail.notes}</p>}
          </div>
        )}

        {meta.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-on-surface/8 px-5 py-4 text-sm text-on-surface-variant">
            <span>Tổng {meta.total} phiếu</span>
            <div className="flex gap-1">
              {Array.from({ length: meta.totalPages }, (_, i) => i + 1).map((p) => (
                <button key={p} type="button" onClick={() => setPage(p)}
                  className={`h-8 w-8 rounded-lg text-xs font-bold transition ${p === page ? 'bg-primary text-white' : 'hover:bg-surface'}`}>{p}</button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Create Adjustment Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/50 p-4 pt-8">
          <div className="w-full max-w-2xl overflow-y-auto rounded-[2rem] bg-white shadow-2xl" style={{ maxHeight: '90vh' }}>
            <div className="sticky top-0 flex items-center justify-between border-b border-on-surface/8 bg-white px-6 py-5">
              <h2 className="text-xl font-black">Tạo phiếu điều chỉnh kho</h2>
              <button type="button" onClick={() => setModalOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full border border-on-surface/10 hover:bg-on-surface/5">
                <X size={17} />
              </button>
            </div>
            <div className="space-y-5 px-6 py-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <FieldWrap label="Kho (tùy chọn)">
                  <select value={whId} onChange={(e) => setWhId(e.target.value)} className={selectCls}>
                    <option value="">— Không chọn —</option>
                    {warehouses.map((w) => <option key={w.warehouseId} value={w.warehouseId}>{w.name}</option>)}
                  </select>
                </FieldWrap>
                <FieldWrap label="Lý do *">
                  <select value={reason} onChange={(e) => setReason(e.target.value as AdjustmentReason)} className={selectCls}>
                    {(Object.keys(ADJ_REASON_LABEL) as AdjustmentReason[]).map((r) => (
                      <option key={r} value={r}>{ADJ_REASON_LABEL[r]}</option>
                    ))}
                  </select>
                </FieldWrap>
                <FieldWrap label="Ngày điều chỉnh">
                  <input type="date" value={adjDate} onChange={(e) => setAdjDate(e.target.value)} className={inputCls} />
                </FieldWrap>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-[0.14em] text-on-surface-variant/60">Dòng hàng</span>
                  <button type="button" onClick={() => setLines((p) => [...p, { productId: '', qtyBefore: 0, qtyAfter: 0, notes: '' }])}
                    className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline">
                    <Plus size={13} /> Thêm dòng
                  </button>
                </div>
                <div className="space-y-2">
                  {lines.map((line, idx) => (
                    <div key={idx} className="grid gap-2 sm:grid-cols-[1fr_90px_90px_32px] items-center">
                      <select value={line.productId} onChange={(e) => handleProductChange(idx, e.target.value)} className={selectCls}>
                        <option value="">— Sản phẩm —</option>
                        {products.map((p) => <option key={p.productId} value={p.productId}>{p.productName} (tồn: {p.quantityAvailable})</option>)}
                      </select>
                      <label className="space-y-0.5">
                        <span className="text-[10px] font-black uppercase tracking-wide text-on-surface-variant/50">SL trước</span>
                        <input type="number" min={0} value={line.qtyBefore}
                          onChange={(e) => setLines((p) => p.map((l, i) => i === idx ? { ...l, qtyBefore: Number(e.target.value) } : l))}
                          className={inputCls} />
                      </label>
                      <label className="space-y-0.5">
                        <span className="text-[10px] font-black uppercase tracking-wide text-on-surface-variant/50">SL sau</span>
                        <input type="number" min={0} value={line.qtyAfter}
                          onChange={(e) => setLines((p) => p.map((l, i) => i === idx ? { ...l, qtyAfter: Number(e.target.value) } : l))}
                          className={inputCls} />
                      </label>
                      <button type="button" disabled={lines.length === 1}
                        onClick={() => setLines((p) => p.filter((_, i) => i !== idx))}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant/40 hover:text-red-500 disabled:opacity-30 mt-5">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <FieldWrap label="Ghi chú">
                <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} />
              </FieldWrap>
            </div>
            <div className="sticky bottom-0 flex justify-end gap-3 border-t border-on-surface/8 bg-white px-6 py-4">
              <button type="button" onClick={() => setModalOpen(false)} className="rounded-xl border border-on-surface/10 px-5 py-2.5 text-sm font-bold hover:bg-on-surface/5">Đóng</button>
              <button type="button" onClick={() => void handleSave()} disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-primary/20 disabled:opacity-60">
                {saving && <LoaderCircle size={15} className="animate-spin" />}Lưu
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
