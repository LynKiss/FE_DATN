import { useEffect, useState } from 'react';
import { Eye, LoaderCircle, PackageSearch } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { apiClient } from '../lib/api';
import { useLanguage } from '../i18n/language-context';
import Modal from '../components/shared/Modal';
import Pagination from '../components/shared/Pagination';

type InventoryTransaction = {
  id: string;
  productId: string;
  productName: string;
  performedBy: string | null;
  transactionType: string;
  quantityChange: number;
  note: string | null;
  relatedOrderId: string | null;
  createdAt: string;
};

type InventoryResponse = {
  items: InventoryTransaction[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export default function ProductInventoryTransactions() {
  const { language } = useLanguage();
  const isVietnamese = language === 'vi';
  const [searchParams, setSearchParams] = useSearchParams();
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [meta, setMeta] = useState<InventoryResponse['meta']>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });
  const [keyword, setKeyword] = useState(searchParams.get('keyword') ?? '');
  const [transactionType, setTransactionType] = useState(searchParams.get('type') ?? 'all');
  const [page, setPage] = useState(Number(searchParams.get('page') ?? '1'));
  const [limit, setLimit] = useState(Number(searchParams.get('limit') ?? '10'));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<InventoryTransaction | null>(null);

  useEffect(() => {
    const nextParams = new URLSearchParams();
    if (keyword.trim()) nextParams.set('keyword', keyword.trim());
    if (transactionType !== 'all') nextParams.set('type', transactionType);
    if (page > 1) nextParams.set('page', String(page));
    if (limit !== 10) nextParams.set('limit', String(limit));
    setSearchParams(nextParams, { replace: true });
  }, [keyword, transactionType, page, limit, setSearchParams]);

  useEffect(() => {
    let cancelled = false;

    async function loadTransactions() {
      setLoading(true);
      setError(null);

      try {
        const query = new URLSearchParams({
          page: String(page),
          limit: String(limit),
          ...(transactionType !== 'all' ? { transactionType } : {}),
        });
        const data = await apiClient.get<InventoryResponse>(`/inventory/transactions?${query.toString()}`);

        if (!cancelled) {
          const filteredItems = keyword.trim()
            ? data.items.filter((item) => item.productName.toLowerCase().includes(keyword.trim().toLowerCase()))
            : data.items;
          setTransactions(filteredItems);
          setMeta(data.meta);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : isVietnamese
                ? 'Không tải được lịch sử kho'
                : 'Unable to load inventory transactions',
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadTransactions();
    return () => {
      cancelled = true;
    };
  }, [keyword, transactionType, page, limit, isVietnamese]);

  useEffect(() => {
    setPage(1);
  }, [keyword, transactionType]);

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="font-headline text-[2.7rem] font-black tracking-tight text-primary">
          {isVietnamese ? 'Lịch Sử Giao Dịch Kho' : 'Inventory Transaction History'}
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-on-surface-variant">
          {isVietnamese
            ? 'Theo dõi các lần nhập kho, điều chỉnh và biến động tồn kho theo từng sản phẩm.'
            : 'Track imports, adjustments, and other inventory movements for each product.'}
        </p>
      </div>

      <section className="rounded-xl border border-on-surface-variant/5 bg-white p-6 shadow-sm">
        <div className="mb-6 grid gap-4 md:grid-cols-[1fr_220px]">
          <label className="grid gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.24em] text-on-surface-variant/50">
              {isVietnamese ? 'Tìm theo tên sản phẩm' : 'Search by product name'}
            </span>
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              className="rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none"
              placeholder={isVietnamese ? 'Nhập tên sản phẩm...' : 'Type a product name...'}
            />
          </label>

          <label className="grid gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.24em] text-on-surface-variant/50">
              {isVietnamese ? 'Loại giao dịch' : 'Transaction type'}
            </span>
            <select
              value={transactionType}
              onChange={(event) => setTransactionType(event.target.value)}
              className="rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none"
            >
              <option value="all">{isVietnamese ? 'Tất cả' : 'All'}</option>
              <option value="import">Import</option>
              <option value="export">Export</option>
              <option value="adjustment">Adjustment</option>
              <option value="return_in">Return in</option>
              <option value="return_out">Return out</option>
              <option value="damage">Damage</option>
            </select>
          </label>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-on-surface-variant/5 text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/40">
                <th className="px-4 py-4">ID</th>
                <th className="px-4 py-4">{isVietnamese ? 'Tên sản phẩm' : 'Product'}</th>
                <th className="px-4 py-4">{isVietnamese ? 'Loại' : 'Type'}</th>
                <th className="px-4 py-4">{isVietnamese ? 'Thay đổi SL' : 'Qty change'}</th>
                <th className="px-4 py-4">{isVietnamese ? 'Ghi chú' : 'Note'}</th>
                <th className="px-4 py-4">{isVietnamese ? 'Người thực hiện' : 'Performed by'}</th>
                <th className="px-4 py-4">{isVietnamese ? 'Ngày tạo' : 'Created at'}</th>
                <th className="px-4 py-4 text-center">{isVietnamese ? 'Hành động' : 'Action'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-on-surface-variant/5">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-sm text-on-surface-variant">
                    <span className="inline-flex items-center gap-2">
                      <LoaderCircle size={16} className="animate-spin" />
                      {isVietnamese ? 'Đang tải giao dịch kho...' : 'Loading inventory transactions...'}
                    </span>
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16">
                    <div className="flex flex-col items-center gap-3 text-center">
                      <PackageSearch size={30} className="text-primary/60" />
                      <p className="text-sm font-bold text-on-surface">
                        {isVietnamese ? 'Không có dữ liệu giao dịch kho' : 'No inventory transactions found'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                transactions.map((item) => (
                  <tr key={item.id} className="hover:bg-on-surface-variant/[0.02]">
                    <td className="px-4 py-4 text-sm font-medium text-on-surface-variant">{item.id}</td>
                    <td className="px-4 py-4">
                      <p className="font-bold text-on-surface">{item.productName}</p>
                      <p className="mt-1 text-xs text-on-surface-variant/60">{item.productId}</p>
                    </td>
                    <td className="px-4 py-4 text-sm font-semibold text-on-surface">{item.transactionType}</td>
                    <td className={`px-4 py-4 text-sm font-black ${item.quantityChange >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                      {item.quantityChange >= 0 ? `+${item.quantityChange}` : item.quantityChange}
                    </td>
                    <td className="px-4 py-4 text-sm text-on-surface-variant">{item.note || '-'}</td>
                    <td className="px-4 py-4 text-sm text-on-surface-variant">{item.performedBy || 'system'}</td>
                    <td className="px-4 py-4 text-sm text-on-surface-variant">
                      {new Date(item.createdAt).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US')}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <button
                        type="button"
                        onClick={() => setSelectedTransaction(item)}
                        className="rounded-xl p-2 text-on-surface-variant hover:bg-primary/5 hover:text-primary"
                      >
                        <Eye size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          page={meta.page}
          limit={meta.limit}
          total={meta.total}
          totalPages={meta.totalPages}
          isVietnamese={isVietnamese}
          onPageChange={setPage}
          onLimitChange={setLimit}
        />
      </section>

      <Modal
        open={!!selectedTransaction}
        title={isVietnamese ? 'Chi tiết giao dịch kho' : 'Inventory transaction detail'}
        onClose={() => setSelectedTransaction(null)}
        size="md"
      >
        {selectedTransaction ? (
          <div className="grid gap-4 text-sm">
            <DetailRow label="ID" value={selectedTransaction.id} />
            <DetailRow label={isVietnamese ? 'Sản phẩm' : 'Product'} value={selectedTransaction.productName} />
            <DetailRow label="Product ID" value={selectedTransaction.productId} />
            <DetailRow label={isVietnamese ? 'Loại giao dịch' : 'Transaction type'} value={selectedTransaction.transactionType} />
            <DetailRow
              label={isVietnamese ? 'Thay đổi số lượng' : 'Quantity change'}
              value={
                selectedTransaction.quantityChange >= 0
                  ? `+${selectedTransaction.quantityChange}`
                  : String(selectedTransaction.quantityChange)
              }
            />
            <DetailRow
              label={isVietnamese ? 'Người thực hiện' : 'Performed by'}
              value={selectedTransaction.performedBy || 'system'}
            />
            <DetailRow
              label={isVietnamese ? 'Đơn hàng liên quan' : 'Related order'}
              value={selectedTransaction.relatedOrderId || '-'}
            />
            <DetailRow
              label={isVietnamese ? 'Ngày tạo' : 'Created at'}
              value={new Date(selectedTransaction.createdAt).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US')}
            />
            <DetailRow label={isVietnamese ? 'Ghi chú' : 'Note'} value={selectedTransaction.note || '-'} />
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <span className="text-[10px] font-black uppercase tracking-[0.18em] text-on-surface-variant/50">{label}</span>
      <div className="rounded-2xl border border-on-surface/8 bg-surface px-4 py-3 text-on-surface">{value}</div>
    </div>
  );
}
