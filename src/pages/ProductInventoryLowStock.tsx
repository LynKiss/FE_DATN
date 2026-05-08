import { useEffect, useState } from 'react';
import { AlertTriangle, LoaderCircle, PackagePlus, PackageSearch, RefreshCw } from 'lucide-react';
import { apiClient } from '../lib/api';
import { useLanguage } from '../i18n/language-context';
import { useToast } from '../hooks/useToast';
import { Link } from 'react-router-dom';

type LowStockProduct = {
  productId: string;
  productName: string;
  quantityAvailable: number;
  unit: string | null;
  barcode: string | null;
};

type SummaryRow = {
  productId: string;
  productName: string;
  quantityAvailable: string;
  barcode: string | null;
  unit: string | null;
  totalImported: string;
  totalDamaged: string;
  totalExported: string;
};

type ActiveTab = 'lowstock' | 'summary';

export default function ProductInventoryLowStock() {
  const { language } = useLanguage();
  const isVietnamese = language === 'vi';
  const { showToast } = useToast();

  const [tab, setTab] = useState<ActiveTab>('lowstock');
  const [threshold, setThreshold] = useState('10');
  const [lowStock, setLowStock] = useState<LowStockProduct[]>([]);
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [loading, setLoading] = useState(false);

  async function loadLowStock() {
    setLoading(true);
    try {
      const data = await apiClient.get<LowStockProduct[]>(
        `/inventory/low-stock?threshold=${threshold}`,
      );
      setLowStock(data);
    } catch (err) {
      showToast({
        tone: 'error',
        title: isVietnamese ? 'Lỗi tải dữ liệu' : 'Failed to load data',
        description: err instanceof Error ? err.message : '',
      });
    } finally {
      setLoading(false);
    }
  }

  async function loadSummary() {
    setLoading(true);
    try {
      const data = await apiClient.get<SummaryRow[]>('/inventory/summary');
      setSummary(data);
    } catch (err) {
      showToast({
        tone: 'error',
        title: isVietnamese ? 'Lỗi tải tổng hợp kho' : 'Failed to load summary',
        description: err instanceof Error ? err.message : '',
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (tab === 'lowstock') void loadLowStock();
    else void loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const urgencyClass = (qty: number) => {
    if (qty === 0) return 'text-red-600 font-black';
    if (qty <= 3) return 'text-red-500 font-black';
    if (qty <= 10) return 'text-yellow-600 font-bold';
    return 'text-on-surface font-semibold';
  };

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="font-headline text-[2.7rem] font-black tracking-tight text-primary">
          {isVietnamese ? 'Tổng Quan Tồn Kho' : 'Inventory Overview'}
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-on-surface-variant">
          {isVietnamese
            ? 'Theo dõi sản phẩm sắp hết hàng và tổng hợp biến động nhập/xuất/hỏng theo từng mặt hàng.'
            : 'Monitor low stock products and view import/export/damage totals per product.'}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 rounded-2xl border border-on-surface-variant/10 bg-surface p-1 w-fit">
        {(['lowstock', 'summary'] as ActiveTab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-black transition-all ${
              tab === t ? 'bg-primary text-white shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            {t === 'lowstock' ? <AlertTriangle size={16} /> : <PackageSearch size={16} />}
            {t === 'lowstock'
              ? isVietnamese ? 'Sắp hết hàng' : 'Low stock'
              : isVietnamese ? 'Tổng hợp kho' : 'Summary'}
          </button>
        ))}
      </div>

      {tab === 'lowstock' && (
        <section className="rounded-xl border border-on-surface-variant/5 bg-white p-6 shadow-sm space-y-5">
          <div className="flex items-end gap-4">
            <label className="grid gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50">
                {isVietnamese ? 'Ngưỡng cảnh báo (≤)' : 'Alert threshold (≤)'}
              </span>
              <input
                type="number"
                min="0"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                className="w-32 rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none"
              />
            </label>
            <button
              type="button"
              onClick={() => void loadLowStock()}
              className="flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-black text-white"
            >
              <RefreshCw size={16} />
              {isVietnamese ? 'Tải lại' : 'Refresh'}
            </button>
          </div>

          {loading ? (
            <div className="py-16 text-center">
              <LoaderCircle size={24} className="mx-auto animate-spin text-primary/60" />
            </div>
          ) : lowStock.length === 0 ? (
            <div className="py-16 text-center">
              <PackageSearch size={32} className="mx-auto text-primary/40" />
              <p className="mt-3 font-bold text-on-surface">
                {isVietnamese
                  ? `Không có sản phẩm nào dưới ngưỡng ${threshold}`
                  : `No products below threshold of ${threshold}`}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-on-surface-variant/5 text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/40">
                    <th className="px-4 py-4">{isVietnamese ? 'Sản phẩm' : 'Product'}</th>
                    <th className="px-4 py-4">{isVietnamese ? 'Barcode' : 'Barcode'}</th>
                    <th className="px-4 py-4">{isVietnamese ? 'Tồn kho' : 'Stock'}</th>
                    <th className="px-4 py-4">{isVietnamese ? 'Đơn vị' : 'Unit'}</th>
                    <th className="px-4 py-4 text-center">{isVietnamese ? 'Hành động' : 'Action'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-on-surface-variant/5">
                  {lowStock.map((p) => (
                    <tr key={p.productId} className="hover:bg-on-surface-variant/[0.02]">
                      <td className="px-4 py-4">
                        <p className="font-bold text-on-surface">{p.productName}</p>
                        <p className="mt-0.5 text-xs text-on-surface-variant/50">{p.productId}</p>
                      </td>
                      <td className="px-4 py-4 text-sm text-on-surface-variant font-mono">
                        {p.barcode ?? '—'}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`text-lg ${urgencyClass(p.quantityAvailable)}`}>
                          {p.quantityAvailable}
                        </span>
                        {p.quantityAvailable === 0 && (
                          <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black text-red-600">
                            {isVietnamese ? 'Hết hàng' : 'Out of stock'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm text-on-surface-variant">{p.unit ?? '—'}</td>
                      <td className="px-4 py-4 text-center">
                        <Link
                          to="/admin/products/import"
                          className="inline-flex items-center gap-1.5 rounded-xl bg-primary/10 px-3 py-1.5 text-xs font-black text-primary hover:bg-primary/20"
                        >
                          <PackagePlus size={14} />
                          {isVietnamese ? 'Nhập kho' : 'Import'}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === 'summary' && (
        <section className="rounded-xl border border-on-surface-variant/5 bg-white p-6 shadow-sm space-y-5">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void loadSummary()}
              className="flex items-center gap-2 rounded-2xl border border-on-surface/10 px-4 py-2 text-sm font-bold hover:bg-surface"
            >
              <RefreshCw size={14} />
              {isVietnamese ? 'Tải lại' : 'Refresh'}
            </button>
          </div>

          {loading ? (
            <div className="py-16 text-center">
              <LoaderCircle size={24} className="mx-auto animate-spin text-primary/60" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-on-surface-variant/5 text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/40">
                    <th className="px-4 py-4">{isVietnamese ? 'Sản phẩm' : 'Product'}</th>
                    <th className="px-4 py-4">{isVietnamese ? 'Tồn kho' : 'In stock'}</th>
                    <th className="px-4 py-4 text-emerald-600">{isVietnamese ? 'Đã nhập' : 'Imported'}</th>
                    <th className="px-4 py-4 text-red-500">{isVietnamese ? 'Hàng hỏng' : 'Damaged'}</th>
                    <th className="px-4 py-4 text-orange-500">{isVietnamese ? 'Đã xuất' : 'Exported'}</th>
                    <th className="px-4 py-4">{isVietnamese ? 'Đơn vị' : 'Unit'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-on-surface-variant/5">
                  {summary.map((row) => (
                    <tr key={row.productId} className="hover:bg-on-surface-variant/[0.02]">
                      <td className="px-4 py-4">
                        <p className="font-bold text-on-surface">{row.productName}</p>
                        {row.barcode && (
                          <p className="mt-0.5 text-xs font-mono text-on-surface-variant/50">{row.barcode}</p>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm font-black text-on-surface">
                        {Number(row.quantityAvailable).toLocaleString()}
                      </td>
                      <td className="px-4 py-4 text-sm font-bold text-emerald-600">
                        +{Number(row.totalImported).toLocaleString()}
                      </td>
                      <td className="px-4 py-4 text-sm font-bold text-red-500">
                        -{Number(row.totalDamaged).toLocaleString()}
                      </td>
                      <td className="px-4 py-4 text-sm font-bold text-orange-500">
                        -{Number(row.totalExported).toLocaleString()}
                      </td>
                      <td className="px-4 py-4 text-sm text-on-surface-variant">{row.unit ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
