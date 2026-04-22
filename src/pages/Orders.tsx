import { useEffect, useMemo, useRef, useState } from 'react';
import { Eye, LoaderCircle, RefreshCw, Search, ShoppingCart } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { apiClient } from '../lib/api';
import { useLanguage } from '../i18n/language-context';
import { useToast } from '../hooks/useToast';
import Pagination from '../components/shared/Pagination';
import Modal from '../components/shared/Modal';

type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipping'
  | 'delivered'
  | 'cancelled'
  | 'returned';

type PaymentStatus = 'unpaid' | 'paid' | 'failed' | 'refunded';

type OrderItem = {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
};

type OrderHistory = {
  id: string;
  oldStatus: OrderStatus | null;
  newStatus: OrderStatus;
  changedBy: string | null;
  note: string | null;
  createdAt: string;
};

type OrderSummary = {
  id: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  totalPayment: string;
  fullName: string;
  phone: string;
  address: string;
  createdAt: string;
  updatedAt: string;
  paymentMethod?: string;
};

type OrderDetail = OrderSummary & {
  subtotalAmount: string;
  discountAmount: string;
  deliveryCost: string;
  totalQuantity: number;
  note: string | null;
  items: OrderItem[];
  history: OrderHistory[];
};

type OrderResponse = {
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  items: OrderSummary[];
};

type BadgeTone = 'amber' | 'sky' | 'slate' | 'primary' | 'emerald' | 'red' | 'zinc';

const STATUS_OPTIONS: OrderStatus[] = [
  'pending',
  'confirmed',
  'processing',
  'shipping',
  'delivered',
  'cancelled',
  'returned',
];

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipping', 'cancelled'],
  shipping: ['delivered', 'returned'],
  delivered: ['returned'],
  cancelled: [],
  returned: [],
};

function getAllowedNextStatuses(current: OrderStatus): OrderStatus[] {
  return ALLOWED_TRANSITIONS[current] ?? [];
}

export default function Orders() {
  const { language } = useLanguage();
  const isVietnamese = language === 'vi';
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [ordersMeta, setOrdersMeta] = useState<OrderResponse['meta']>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [status, setStatus] = useState<'all' | OrderStatus>(
    (searchParams.get('status') as 'all' | OrderStatus) ?? 'all',
  );
  const [page, setPage] = useState(Number(searchParams.get('page') ?? '1'));
  const [limit, setLimit] = useState(Number(searchParams.get('limit') ?? '10'));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null);
  const [nextStatus, setNextStatus] = useState<OrderStatus>('pending');
  const [statusNote, setStatusNote] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const currency = useMemo(
    () =>
      new Intl.NumberFormat(isVietnamese ? 'vi-VN' : 'en-US', {
        style: 'currency',
        currency: 'VND',
        maximumFractionDigits: 0,
      }),
    [isVietnamese],
  );
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(isVietnamese ? 'vi-VN' : 'en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    [isVietnamese],
  );

  useEffect(() => {
    const nextParams = new URLSearchParams();
    if (search.trim()) nextParams.set('search', search.trim());
    if (status !== 'all') nextParams.set('status', status);
    if (page > 1) nextParams.set('page', String(page));
    if (limit !== 10) nextParams.set('limit', String(limit));
    setSearchParams(nextParams, { replace: true });
  }, [search, status, page, limit, setSearchParams]);

  useEffect(() => {
    let cancelled = false;

    async function loadOrders() {
      setLoading(true);
      setError(null);

      try {
        const query = new URLSearchParams({
          page: String(page),
          limit: String(limit),
        });

        if (status !== 'all') query.set('status', status);
        if (search.trim()) query.set('search', search.trim());

        const data = await apiClient.get<OrderResponse>(`/orders?${query.toString()}`);

        if (!cancelled) {
          setOrders(data.items);
          setOrdersMeta(data.meta);
          setLastUpdated(new Date());
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : isVietnamese
                ? 'Không tải được danh sách đơn hàng'
                : 'Unable to load orders',
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadOrders();
    return () => {
      cancelled = true;
    };
  }, [search, status, isVietnamese, page, limit, reloadKey]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setReloadKey((k) => k + 1);
    }, 60_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, status]);

  async function openOrderDetail(orderId: string) {
    setDetailOpen(true);
    setDetailLoading(true);

    try {
      const detail = await apiClient.get<OrderDetail>(`/orders/${orderId}`);
      setSelectedOrder(detail);
      const allowed = getAllowedNextStatuses(detail.status);
      setNextStatus(allowed[0] ?? detail.status);
      setStatusNote('');
    } catch (detailError) {
      showToast({
        tone: 'error',
        title: isVietnamese ? 'Không tải được chi tiết đơn hàng' : 'Unable to load order detail',
        description: detailError instanceof Error ? detailError.message : '',
      });
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleUpdateStatus() {
    if (!selectedOrder) return;

    setUpdatingStatus(true);
    try {
      const updated = await apiClient.patch<OrderDetail>(`/orders/${selectedOrder.id}/status`, {
        status: nextStatus,
        note: statusNote.trim() || undefined,
      });

      setSelectedOrder(updated);
      setStatusNote('');
      setOrders((current) =>
        current.map((order) =>
          order.id === updated.id
            ? { ...order, status: updated.status, updatedAt: updated.updatedAt }
            : order,
        ),
      );

      showToast({
        tone: 'success',
        title: isVietnamese ? 'Đã cập nhật trạng thái đơn hàng' : 'Order status updated',
      });
    } catch (updateError) {
      showToast({
        tone: 'error',
        title: isVietnamese ? 'Cập nhật trạng thái thất bại' : 'Status update failed',
        description: updateError instanceof Error ? updateError.message : '',
      });
    } finally {
      setUpdatingStatus(false);
    }
  }

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-4xl font-black tracking-tight text-primary">
          {isVietnamese ? 'Quản lý đơn hàng' : 'Order Management'}
        </h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          {isVietnamese
            ? 'Theo dõi đơn hàng, thanh toán và cập nhật trạng thái giao vận trong cùng một màn hình.'
            : 'Track orders, payment status, and fulfillment progress from one screen.'}
        </p>
      </div>

      <section className="rounded-[2rem] border border-on-surface/8 bg-white p-5 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1.3fr_240px_140px_auto]">
          <label className="relative">
            <Search
              size={16}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={
                isVietnamese
                  ? 'Tìm theo mã đơn, khách hàng, số điện thoại'
                  : 'Search by order, customer, phone'
              }
              className="w-full rounded-2xl border border-on-surface/10 bg-surface py-3 pl-11 pr-4 text-sm outline-none"
            />
          </label>

          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as 'all' | OrderStatus)}
            className="rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none"
          >
            <option value="all">{isVietnamese ? 'Tất cả trạng thái' : 'All statuses'}</option>
            {STATUS_OPTIONS.map((item) => (
              <option key={item} value={item}>
                {getStatusLabel(item, isVietnamese)}
              </option>
            ))}
          </select>

          <select
            value={limit}
            onChange={(event) => {
              setLimit(Number(event.target.value));
              setPage(1);
            }}
            className="rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none"
          >
            {[10, 20, 50].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>

          <div className="flex flex-col items-end justify-center gap-1">
            <button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm font-semibold text-on-surface-variant transition hover:border-primary/30 hover:text-primary disabled:opacity-50"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              {isVietnamese ? 'Làm mới' : 'Refresh'}
            </button>
            {lastUpdated && (
              <p className="text-[10px] text-on-surface-variant/50">
                {isVietnamese ? 'Cập nhật lần cuối: ' : 'Last updated: '}
                {lastUpdated.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { status: 'pending', label: isVietnamese ? 'Chờ xử lý' : 'Pending', color: 'amber' },
          { status: 'confirmed', label: isVietnamese ? 'Đã xác nhận' : 'Confirmed', color: 'sky' },
          { status: 'processing', label: isVietnamese ? 'Đang xử lý' : 'Processing', color: 'slate' },
          { status: 'shipping', label: isVietnamese ? 'Đang giao' : 'Shipping', color: 'blue' },
        ].map(({ status: s, label }) => {
          const count = orders.filter((o) => o.status === s).length;
          return (
            <div
              key={s}
              className="rounded-2xl border border-on-surface/8 bg-white p-4 text-center shadow-sm"
            >
              <p className="text-2xl font-black text-primary">{count}</p>
              <p className="mt-1 text-xs text-on-surface-variant">{label}</p>
            </div>
          );
        })}
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-[2rem] border border-on-surface/8 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead className="border-b border-on-surface/8 bg-surface/70 text-[11px] font-black uppercase tracking-[0.18em] text-on-surface-variant/60">
              <tr>
                <th className="px-4 py-4">{isVietnamese ? 'Mã đơn' : 'Order ID'}</th>
                <th className="px-4 py-4">{isVietnamese ? 'Khách hàng' : 'Customer'}</th>
                <th className="px-4 py-4">{isVietnamese ? 'Liên hệ' : 'Contact'}</th>
                <th className="px-4 py-4">{isVietnamese ? 'Tổng tiền' : 'Total'}</th>
                <th className="px-4 py-4">{isVietnamese ? 'Thanh toán' : 'Payment'}</th>
                <th className="px-4 py-4">{isVietnamese ? 'Trạng thái' : 'Status'}</th>
                <th className="px-4 py-4">{isVietnamese ? 'Ngày tạo' : 'Created at'}</th>
                <th className="px-4 py-4 text-center">{isVietnamese ? 'Hành động' : 'Action'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-on-surface/6 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center text-on-surface-variant">
                    <span className="inline-flex items-center gap-2">
                      <LoaderCircle size={16} className="animate-spin" />
                      {isVietnamese ? 'Đang tải đơn hàng...' : 'Loading orders...'}
                    </span>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center text-on-surface-variant">
                    <ShoppingCart size={28} className="mx-auto mb-3 text-primary/50" />
                    {isVietnamese ? 'Không có đơn hàng phù hợp' : 'No matching orders'}
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="hover:bg-surface/40">
                    <td className="px-4 py-4 font-semibold text-primary">{order.id}</td>
                    <td className="px-4 py-4">
                      <p className="font-semibold text-on-surface">{order.fullName}</p>
                      <p className="text-xs text-on-surface-variant">{order.address}</p>
                    </td>
                    <td className="px-4 py-4 text-on-surface-variant">{order.phone}</td>
                    <td className="px-4 py-4 font-semibold text-on-surface">
                      {currency.format(Number(order.totalPayment))}
                    </td>
                    <td className="px-4 py-4">
                      <Badge tone={getPaymentTone(order.paymentStatus)}>
                        {getPaymentLabel(order.paymentStatus, isVietnamese)}
                      </Badge>
                    </td>
                    <td className="px-4 py-4">
                      <Badge tone={getStatusTone(order.status)}>
                        {getStatusLabel(order.status, isVietnamese)}
                      </Badge>
                    </td>
                    <td className="px-4 py-4 text-on-surface-variant">
                      {dateFormatter.format(new Date(order.createdAt))}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <button
                        type="button"
                        onClick={() => void openOrderDetail(order.id)}
                        className="rounded-xl p-2 text-on-surface-variant transition hover:bg-primary/5 hover:text-primary"
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

        <div className="px-5 pb-5">
          <Pagination
            page={ordersMeta.page}
            limit={ordersMeta.limit}
            total={ordersMeta.total}
            totalPages={ordersMeta.totalPages}
            isVietnamese={isVietnamese}
            onPageChange={setPage}
            onLimitChange={(nextLimit) => {
              setLimit(nextLimit);
              setPage(1);
            }}
            pageSizeOptions={[10, 20, 50]}
          />
        </div>
      </section>

      <Modal
        open={detailOpen}
        title={isVietnamese ? 'Chi tiết đơn hàng' : 'Order detail'}
        onClose={() => {
          setDetailOpen(false);
          setSelectedOrder(null);
        }}
        size="xl"
        footer={
          selectedOrder ? (
            <div className="flex flex-wrap items-center justify-end gap-3">
              {getAllowedNextStatuses(selectedOrder.status).length === 0 ? (
                <span className="rounded-2xl border border-on-surface/10 bg-surface/60 px-4 py-2.5 text-sm text-on-surface-variant/60 italic">
                  {isVietnamese ? 'Đơn hàng đã kết thúc' : 'Order is finalized'}
                </span>
              ) : (
                <select
                  value={nextStatus}
                  onChange={(event) => setNextStatus(event.target.value as OrderStatus)}
                  className="rounded-2xl border border-on-surface/10 bg-surface px-4 py-2.5 text-sm outline-none"
                >
                  {getAllowedNextStatuses(selectedOrder.status).map((item) => (
                    <option key={item} value={item}>
                      {getStatusLabel(item, isVietnamese)}
                    </option>
                  ))}
                </select>
              )}
              {getAllowedNextStatuses(selectedOrder.status).length > 0 && (
                <>
                  <input
                    value={statusNote}
                    onChange={(event) => setStatusNote(event.target.value)}
                    placeholder={isVietnamese ? 'Ghi chú cập nhật' : 'Status note'}
                    className="w-full rounded-2xl border border-on-surface/10 bg-surface px-4 py-2.5 text-sm outline-none sm:w-64"
                  />
                  <button
                    type="button"
                    onClick={() => void handleUpdateStatus()}
                    disabled={updatingStatus}
                    className="rounded-2xl bg-primary px-5 py-2.5 text-sm font-black text-white disabled:opacity-60"
                  >
                    {updatingStatus
                      ? isVietnamese
                        ? 'Đang cập nhật...'
                        : 'Updating...'
                      : isVietnamese
                        ? 'Cập nhật trạng thái'
                        : 'Update status'}
                  </button>
                </>
              )}
            </div>
          ) : undefined
        }
      >
        {detailLoading ? (
          <div className="py-16 text-center text-on-surface-variant">
            <LoaderCircle size={18} className="mx-auto animate-spin" />
          </div>
        ) : selectedOrder ? (
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <DetailCard label={isVietnamese ? 'Mã đơn' : 'Order ID'} value={selectedOrder.id} />
                <DetailCard
                  label={isVietnamese ? 'Phương thức thanh toán' : 'Payment method'}
                  value={selectedOrder.paymentMethod || '—'}
                />
                <DetailCard
                  label={isVietnamese ? 'Khách hàng' : 'Customer'}
                  value={selectedOrder.fullName}
                />
                <DetailCard label={isVietnamese ? 'Số điện thoại' : 'Phone'} value={selectedOrder.phone} />
                <DetailCard
                  label={isVietnamese ? 'Địa chỉ' : 'Address'}
                  value={selectedOrder.address}
                />
                <DetailCard
                  label={isVietnamese ? 'Ngày tạo' : 'Created at'}
                  value={dateFormatter.format(new Date(selectedOrder.createdAt))}
                />
              </div>

              <div className="rounded-[1.5rem] border border-on-surface/8 bg-surface/50 p-4">
                <h3 className="text-sm font-black uppercase tracking-[0.18em] text-on-surface-variant/60">
                  {isVietnamese ? 'Sản phẩm trong đơn' : 'Order items'}
                </h3>
                <div className="mt-4 space-y-3">
                  {selectedOrder.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-4 rounded-2xl bg-white px-4 py-3"
                    >
                      <div>
                        <p className="font-semibold text-on-surface">{item.productName}</p>
                        <p className="text-xs text-on-surface-variant">{item.productId}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-on-surface">
                          {item.quantity} × {currency.format(Number(item.unitPrice))}
                        </p>
                        <p className="text-xs text-on-surface-variant">
                          {currency.format(Number(item.lineTotal))}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-[1.5rem] border border-on-surface/8 bg-surface/50 p-4">
                <h3 className="text-sm font-black uppercase tracking-[0.18em] text-on-surface-variant/60">
                  {isVietnamese ? 'Tổng hợp thanh toán' : 'Payment summary'}
                </h3>
                <div className="mt-4 space-y-3 text-sm">
                  <SummaryRow
                    label={isVietnamese ? 'Tạm tính' : 'Subtotal'}
                    value={currency.format(Number(selectedOrder.subtotalAmount))}
                  />
                  <SummaryRow
                    label={isVietnamese ? 'Giảm giá' : 'Discount'}
                    value={currency.format(Number(selectedOrder.discountAmount))}
                  />
                  <SummaryRow
                    label={isVietnamese ? 'Phí giao hàng' : 'Delivery'}
                    value={currency.format(Number(selectedOrder.deliveryCost))}
                  />
                  <SummaryRow
                    label={isVietnamese ? 'Tổng thanh toán' : 'Total payment'}
                    value={currency.format(Number(selectedOrder.totalPayment))}
                    strong
                  />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge tone={getPaymentTone(selectedOrder.paymentStatus)}>
                    {getPaymentLabel(selectedOrder.paymentStatus, isVietnamese)}
                  </Badge>
                  <Badge tone={getStatusTone(selectedOrder.status)}>
                    {getStatusLabel(selectedOrder.status, isVietnamese)}
                  </Badge>
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-on-surface/8 bg-surface/50 p-4">
                <h3 className="text-sm font-black uppercase tracking-[0.18em] text-on-surface-variant/60">
                  {isVietnamese ? 'Lịch sử trạng thái' : 'Status history'}
                </h3>
                <div className="mt-4 space-y-3">
                  {selectedOrder.history.length === 0 ? (
                    <p className="text-sm text-on-surface-variant">
                      {isVietnamese ? 'Chưa có lịch sử cập nhật' : 'No status history yet'}
                    </p>
                  ) : (
                    selectedOrder.history.map((item) => (
                      <div key={item.id} className="rounded-2xl bg-white px-4 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold text-on-surface">
                            {(item.oldStatus ? getStatusLabel(item.oldStatus, isVietnamese) : '—') +
                              ' → ' +
                              getStatusLabel(item.newStatus, isVietnamese)}
                          </p>
                          <span className="text-xs text-on-surface-variant">
                            {dateFormatter.format(new Date(item.createdAt))}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-on-surface-variant">
                          {item.changedBy || 'system'}
                        </p>
                        {item.note ? (
                          <p className="mt-2 text-sm text-on-surface">{item.note}</p>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function getStatusLabel(status: OrderStatus, isVietnamese: boolean) {
  const labels: Record<OrderStatus, string> = isVietnamese
    ? {
        pending: 'Chờ xử lý',
        confirmed: 'Đã xác nhận',
        processing: 'Đang xử lý',
        shipping: 'Đang giao',
        delivered: 'Đã giao',
        cancelled: 'Đã hủy',
        returned: 'Đã hoàn',
      }
    : {
        pending: 'Pending',
        confirmed: 'Confirmed',
        processing: 'Processing',
        shipping: 'Shipping',
        delivered: 'Delivered',
        cancelled: 'Cancelled',
        returned: 'Returned',
      };

  return labels[status];
}

function getPaymentLabel(status: PaymentStatus, isVietnamese: boolean) {
  const labels: Record<PaymentStatus, string> = isVietnamese
    ? {
        unpaid: 'Chưa thanh toán',
        paid: 'Đã thanh toán',
        failed: 'Thất bại',
        refunded: 'Đã hoàn tiền',
      }
    : {
        unpaid: 'Unpaid',
        paid: 'Paid',
        failed: 'Failed',
        refunded: 'Refunded',
      };

  return labels[status];
}

function getStatusTone(status: OrderStatus): BadgeTone {
  const tones: Record<OrderStatus, BadgeTone> = {
    pending: 'amber',
    confirmed: 'sky',
    processing: 'slate',
    shipping: 'primary',
    delivered: 'emerald',
    cancelled: 'red',
    returned: 'zinc',
  };
  return tones[status];
}

function getPaymentTone(status: PaymentStatus): BadgeTone {
  const tones: Record<PaymentStatus, BadgeTone> = {
    unpaid: 'red',
    paid: 'emerald',
    failed: 'amber',
    refunded: 'sky',
  };
  return tones[status];
}

function Badge({ children, tone }: { children: string; tone: BadgeTone }) {
  const classes: Record<BadgeTone, string> = {
    amber: 'bg-amber-100 text-amber-700',
    sky: 'bg-sky-100 text-sky-700',
    slate: 'bg-slate-100 text-slate-700',
    primary: 'bg-primary/10 text-primary',
    emerald: 'bg-emerald-100 text-emerald-700',
    red: 'bg-red-100 text-red-700',
    zinc: 'bg-zinc-100 text-zinc-700',
  };

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${classes[tone]}`}>
      {children}
    </span>
  );
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface px-4 py-3">
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-on-surface-variant/60">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-on-surface">{value}</p>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-on-surface-variant">{label}</span>
      <span className={strong ? 'font-bold text-on-surface' : 'font-semibold text-on-surface'}>
        {value}
      </span>
    </div>
  );
}
