import { useEffect, useState, useCallback } from 'react';
import { BookOpen, ChevronLeft, ChevronRight, Filter, RefreshCw } from 'lucide-react';
import { apiClient } from '../../../lib/api';

type Product = { productId: string; productName: string };
type TxType = 'import' | 'export' | 'adjustment' | 'return_in' | 'return_out' | 'damage';

interface LedgerItem {
  transactionId: string;
  productId: string;
  productName: string;
  transactionType: TxType;
  quantityChange: number;
  quantityBefore: number | null;
  quantityAfter: number | null;
  referenceType: string | null;
  referenceId: string | null;
  note: string | null;
  performedBy: string | null;
  createdAt: string;
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  import:      { label: 'Nhập kho',     color: 'bg-green-100 text-green-700' },
  export:      { label: 'Xuất kho',     color: 'bg-blue-100 text-blue-700' },
  adjustment:  { label: 'Điều chỉnh +', color: 'bg-yellow-100 text-yellow-700' },
  damage:      { label: 'Hàng hỏng -',  color: 'bg-red-100 text-red-700' },
  return_in:   { label: 'NCC trả vào',  color: 'bg-teal-100 text-teal-700' },
  return_out:  { label: 'Trả NCC',      color: 'bg-orange-100 text-orange-700' },
};

const REF_TYPE_LABELS: Record<string, string> = {
  GR: 'Phiếu nhập', SR: 'Trả NCC', TR: 'Chuyển kho', ADJ: 'Điều chỉnh',
};

export default function InventoryLedgerPage() {
  const [items, setItems] = useState<LedgerItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const [filterProductId, setFilterProductId] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  const limit = 30;
  const totalPages = Math.ceil(total / limit);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(limit) });
      if (filterProductId) params.set('productId', filterProductId);
      if (filterType) params.set('transactionType', filterType);
      if (filterFrom) params.set('from', filterFrom);
      if (filterTo) params.set('to', filterTo + 'T23:59:59');
      const data = await apiClient.get<{ items: LedgerItem[]; meta: { total: number } }>(
        `/reports/inventory-ledger?${params.toString()}`,
      );
      setItems(data.items ?? []);
      setTotal(data.meta?.total ?? 0);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [filterProductId, filterType, filterFrom, filterTo]);

  useEffect(() => {
    void apiClient
      .get<{ items: Product[] }>('/products?limit=500&includeHidden=true')
      .then((d) => setProducts(d.items ?? []));
  }, []);

  useEffect(() => {
    setPage(1);
    void load(1);
  }, [load]);

  const fmtQty = (n: number) => {
    if (n > 0) return <span className="font-medium text-green-600">+{n}</span>;
    return <span className="font-medium text-red-600">{n}</span>;
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <BookOpen className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-bold text-on-surface">Sổ Kho Chi Tiết</h1>
        <span className="ml-auto text-sm text-on-surface-variant">{total} giao dịch</span>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-outline-variant bg-surface p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-1.5 text-sm font-medium text-on-surface-variant">
            <Filter className="h-4 w-4" /> Lọc:
          </div>
          <div>
            <label className="mb-1 block text-xs text-on-surface-variant">Sản phẩm</label>
            <select
              className="rounded-lg border border-outline-variant bg-surface px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary"
              value={filterProductId}
              onChange={(e) => setFilterProductId(e.target.value)}
            >
              <option value="">Tất cả sản phẩm</option>
              {products.map((p) => (
                <option key={p.productId} value={p.productId}>{p.productName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-on-surface-variant">Loại giao dịch</label>
            <select
              className="rounded-lg border border-outline-variant bg-surface px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="">Tất cả</option>
              {Object.entries(TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-on-surface-variant">Từ ngày</label>
            <input
              type="date"
              className="rounded-lg border border-outline-variant bg-surface px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-on-surface-variant">Đến ngày</label>
            <input
              type="date"
              className="rounded-lg border border-outline-variant bg-surface px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary"
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
            />
          </div>
          <button
            onClick={() => { setFilterProductId(''); setFilterType(''); setFilterFrom(''); setFilterTo(''); }}
            className="rounded-lg border border-outline-variant px-3 py-1.5 text-sm hover:bg-surface-variant"
          >
            Xóa lọc
          </button>
          <button
            onClick={() => void load(page)}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm text-white hover:bg-primary/90"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Làm mới
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-outline-variant bg-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-variant text-on-surface-variant">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Thời gian</th>
                <th className="px-4 py-3 text-left font-medium">Sản phẩm</th>
                <th className="px-4 py-3 text-left font-medium">Loại</th>
                <th className="px-4 py-3 text-right font-medium">Trước</th>
                <th className="px-4 py-3 text-right font-medium">Thay đổi</th>
                <th className="px-4 py-3 text-right font-medium">Sau</th>
                <th className="px-4 py-3 text-left font-medium">Chứng từ</th>
                <th className="px-4 py-3 text-left font-medium">Ghi chú</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-on-surface-variant">Đang tải...</td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-on-surface-variant">Không có giao dịch</td>
                </tr>
              ) : items.map((item) => {
                const typeInfo = TYPE_LABELS[item.transactionType] ?? { label: item.transactionType, color: 'bg-gray-100 text-gray-600' };
                return (
                  <tr key={item.transactionId} className="hover:bg-surface-variant/40">
                    <td className="px-4 py-2.5 text-xs text-on-surface-variant whitespace-nowrap">
                      {new Date(item.createdAt).toLocaleString('vi-VN')}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-on-surface max-w-[200px] truncate">
                      {item.productName}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${typeInfo.color}`}>
                        {typeInfo.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-on-surface-variant">
                      {item.quantityBefore != null ? item.quantityBefore : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {fmtQty(item.quantityChange)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-on-surface">
                      {item.quantityAfter != null ? item.quantityAfter : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-on-surface-variant">
                      {item.referenceType
                        ? <span className="font-medium">{REF_TYPE_LABELS[item.referenceType] ?? item.referenceType}</span>
                        : '—'
                      }
                    </td>
                    <td className="px-4 py-2.5 text-xs text-on-surface-variant max-w-[200px] truncate">
                      {item.note ?? '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-outline-variant px-4 py-3">
            <span className="text-sm text-on-surface-variant">
              Trang {page}/{totalPages} — {total} giao dịch
            </span>
            <div className="flex gap-1">
              <button
                disabled={page <= 1}
                onClick={() => { const p = page - 1; setPage(p); void load(p); }}
                className="rounded p-1.5 hover:bg-surface-variant disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => { const p = page + 1; setPage(p); void load(p); }}
                className="rounded p-1.5 hover:bg-surface-variant disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
