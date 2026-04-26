import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Eye,
  LoaderCircle,
  MapPin,
  Navigation,
  RefreshCw,
  Save,
  Search,
  ShoppingCart,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { apiClient } from '../lib/api';
import { useLanguage } from '../i18n/language-context';
import { useToast } from '../hooks/useToast';
import Pagination from '../components/shared/Pagination';
import Modal from '../components/shared/Modal';
import {
  TRACKING_MODE_LABELS,
  TRACKING_SOURCE_LABELS,
  type OrderTracking,
  type TrackingMode,
} from '../lib/order-tracking';

type OrderStatus =
  | 'pending'
  | 'backordered'
  | 'confirmed'
  | 'processing'
  | 'shipping'
  | 'delivered'
  | 'partial_delivered'
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

type ManualTrackingForm = {
  latitude: string;
  longitude: string;
  note: string;
};

type LiveTrackingForm = {
  latitude: string;
  longitude: string;
  heading: string;
  speedKph: string;
  provider: string;
};

const STATUS_OPTIONS: OrderStatus[] = [
  'backordered',
  'pending',
  'confirmed',
  'processing',
  'shipping',
  'delivered',
  'partial_delivered',
  'cancelled',
  'returned',
];

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  backordered: ['pending', 'cancelled'],
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipping', 'cancelled'],
  shipping: ['delivered', 'partial_delivered', 'returned'],
  partial_delivered: ['returned'],
  delivered: ['returned'],
  cancelled: [],
  returned: [],
};

const EMPTY_MANUAL_FORM: ManualTrackingForm = {
  latitude: '',
  longitude: '',
  note: '',
};

const EMPTY_LIVE_FORM: LiveTrackingForm = {
  latitude: '',
  longitude: '',
  heading: '',
  speedKph: '',
  provider: '',
};

function getAllowedNextStatuses(current: OrderStatus): OrderStatus[] {
  return ALLOWED_TRANSITIONS[current] ?? [];
}

function getMapEmbedUrl(latitude: number, longitude: number) {
  return `https://www.openstreetmap.org/export/embed.html?bbox=${longitude - 0.03
    },${latitude - 0.03},${longitude + 0.03},${latitude + 0.03}&layer=mapnik&marker=${latitude},${longitude}`;
}

function formatTrackingTime(value: string | null) {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });
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

  const [tracking, setTracking] = useState<OrderTracking | null>(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [modeSaving, setModeSaving] = useState(false);
  const [manualSaving, setManualSaving] = useState(false);
  const [liveSaving, setLiveSaving] = useState(false);
  const [manualForm, setManualForm] = useState<ManualTrackingForm>(EMPTY_MANUAL_FORM);
  const [liveForm, setLiveForm] = useState<LiveTrackingForm>(EMPTY_LIVE_FORM);

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

  const activeMapPoint = tracking?.activeLocation ?? tracking?.manualLocation ?? tracking?.gpsLocation ?? null;

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
                ? 'Khong tai duoc danh sach don hang'
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

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setReloadKey((current) => current + 1);
    }, 60_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, status]);

  useEffect(() => {
    if (!detailOpen || !selectedOrder) {
      return;
    }

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const loadTracking = async (silent = false) => {
      if (!selectedOrder) {
        return;
      }

      if (!silent) {
        setTrackingLoading(true);
      }

      try {
        const nextTracking = await apiClient.get<OrderTracking>(
          `/orders/${selectedOrder.id}/tracking`,
        );

        if (cancelled) {
          return;
        }

        setTracking(nextTracking);

        if (!manualForm.latitude && nextTracking.manualLocation) {
          setManualForm({
            latitude: String(nextTracking.manualLocation.latitude),
            longitude: String(nextTracking.manualLocation.longitude),
            note: nextTracking.manualLocation.note ?? '',
          });
        }

        if (!liveForm.latitude && nextTracking.gpsLocation) {
          setLiveForm({
            latitude: String(nextTracking.gpsLocation.latitude),
            longitude: String(nextTracking.gpsLocation.longitude),
            heading:
              nextTracking.gpsLocation.heading !== null
                ? String(nextTracking.gpsLocation.heading)
                : '',
            speedKph:
              nextTracking.gpsLocation.speedKph !== null
                ? String(nextTracking.gpsLocation.speedKph)
                : '',
            provider: nextTracking.gpsLocation.provider ?? '',
          });
        }
      } catch (trackingError) {
        if (!cancelled && !silent) {
          showToast({
            tone: 'error',
            title: isVietnamese ? 'Không tải được tracking' : 'Unable to load tracking',
            description: trackingError instanceof Error ? trackingError.message : '',
          });
        }
      } finally {
        if (!cancelled && !silent) {
          setTrackingLoading(false);
        }
      }
    };

    void loadTracking();
    intervalId = setInterval(() => {
      void loadTracking(true);
    }, 5_000);

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [detailOpen, selectedOrder?.id, isVietnamese, showToast]);

  async function openOrderDetail(orderId: string) {
    setDetailOpen(true);
    setDetailLoading(true);
    setTracking(null);
    setManualForm(EMPTY_MANUAL_FORM);
    setLiveForm(EMPTY_LIVE_FORM);

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
      const updated = await apiClient.patch<OrderDetail>(
        `/orders/${selectedOrder.id}/status`,
        {
          status: nextStatus,
          note: statusNote.trim() || undefined,
        },
      );

      setSelectedOrder(updated);
      setStatusNote('');
      setOrders((current) =>
        current.map((order) =>
          order.id === updated.id
            ? {
              ...order,
              status: updated.status,
              updatedAt: updated.updatedAt,
            }
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

  async function handleUpdateTrackingMode(mode: TrackingMode) {
    if (!selectedOrder) {
      return;
    }

    setModeSaving(true);
    try {
      const updated = await apiClient.patch<OrderTracking>(
        `/orders/${selectedOrder.id}/tracking/mode`,
        { mode },
      );
      setTracking(updated);
      showToast({
        tone: 'success',
        title: isVietnamese ? 'Đã đổi chế độ tracking' : 'Tracking mode updated',
      });
    } catch (trackingError) {
      showToast({
        tone: 'error',
        title: isVietnamese ? 'Cập nhật mode thất bại' : 'Unable to update mode',
        description: trackingError instanceof Error ? trackingError.message : '',
      });
    } finally {
      setModeSaving(false);
    }
  }

  async function handleUpdateManualTracking() {
    if (!selectedOrder || !manualForm.latitude.trim() || !manualForm.longitude.trim()) {
      return;
    }

    setManualSaving(true);
    try {
      const updated = await apiClient.patch<OrderTracking>(
        `/orders/${selectedOrder.id}/tracking/manual`,
        {
          latitude: Number(manualForm.latitude),
          longitude: Number(manualForm.longitude),
          note: manualForm.note.trim() || undefined,
        },
      );
      setTracking(updated);
      showToast({
        tone: 'success',
        title: isVietnamese ? 'Đã cập nhật điểm demo' : 'Manual tracking updated',
      });
    } catch (trackingError) {
      showToast({
        tone: 'error',
        title: isVietnamese ? 'Cập nhật điểm demo thất bại' : 'Unable to update manual tracking',
        description: trackingError instanceof Error ? trackingError.message : '',
      });
    } finally {
      setManualSaving(false);
    }
  }

  async function handleUpdateLiveTracking() {
    if (!selectedOrder || !liveForm.latitude.trim() || !liveForm.longitude.trim()) {
      return;
    }

    setLiveSaving(true);
    try {
      const updated = await apiClient.patch<OrderTracking>(
        `/orders/${selectedOrder.id}/tracking/live`,
        {
          latitude: Number(liveForm.latitude),
          longitude: Number(liveForm.longitude),
          heading: liveForm.heading ? Number(liveForm.heading) : undefined,
          speedKph: liveForm.speedKph ? Number(liveForm.speedKph) : undefined,
          provider: liveForm.provider.trim() || undefined,
        },
      );
      setTracking(updated);
      showToast({
        tone: 'success',
        title: isVietnamese ? 'Đã cập nhật GPS live' : 'Live GPS updated',
      });
    } catch (trackingError) {
      showToast({
        tone: 'error',
        title: isVietnamese ? 'Cập nhật GPS thất bại' : 'Unable to update GPS',
        description: trackingError instanceof Error ? trackingError.message : '',
      });
    } finally {
      setLiveSaving(false);
    }
  }

  function seedManualFrom(source: 'active' | 'gps' | 'manual') {
    const point =
      source === 'active'
        ? tracking?.activeLocation
        : source === 'gps'
          ? tracking?.gpsLocation
          : tracking?.manualLocation;

    if (!point) {
      return;
    }

    setManualForm((current) => ({
      ...current,
      latitude: String(point.latitude),
      longitude: String(point.longitude),
      note: source === 'manual' ? current.note : `${source.toUpperCase()} seed`,
    }));
  }

  function nudgeManual(latitudeDelta: number, longitudeDelta: number) {
    const baseLatitude = Number(
      manualForm.latitude ||
      tracking?.manualLocation?.latitude ||
      tracking?.activeLocation?.latitude,
    );
    const baseLongitude = Number(
      manualForm.longitude ||
      tracking?.manualLocation?.longitude ||
      tracking?.activeLocation?.longitude,
    );

    if (!Number.isFinite(baseLatitude) || !Number.isFinite(baseLongitude)) {
      return;
    }

    setManualForm((current) => ({
      ...current,
      latitude: (baseLatitude + latitudeDelta).toFixed(6),
      longitude: (baseLongitude + longitudeDelta).toFixed(6),
    }));
  }

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-4xl font-black tracking-tight text-primary">
          {isVietnamese ? 'Quản lý đơn hàng' : 'Order Management'}
        </h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          {isVietnamese
            ? 'Theo doi don hang, thanh toan va tracking giao hang realtime trong mot man hinh.'
            : 'Track orders, payment status, and live delivery tracking in one screen.'}
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
                  ? 'Tim theo ma don, khach hang, so dien thoai'
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
              onClick={() => setReloadKey((current) => current + 1)}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm font-semibold text-on-surface-variant transition hover:border-primary/30 hover:text-primary disabled:opacity-50"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              {isVietnamese ? 'Làm mới' : 'Refresh'}
            </button>
            {lastUpdated && (
              <p className="text-[10px] text-on-surface-variant/50">
                {isVietnamese ? 'Cập nhật lúc: ' : 'Last updated: '}
                {lastUpdated.toLocaleTimeString('vi-VN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </p>
            )}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {[
          { status: 'backordered', label: isVietnamese ? 'Chờ hàng' : 'Backordered', color: 'text-rose-600', bg: 'bg-rose-50' },
          { status: 'pending', label: isVietnamese ? 'Chờ xử lý' : 'Pending', color: 'text-amber-600', bg: 'bg-amber-50' },
          { status: 'confirmed', label: isVietnamese ? 'Đã xác nhận' : 'Confirmed', color: 'text-sky-600', bg: 'bg-sky-50' },
          { status: 'processing', label: isVietnamese ? 'Đang xử lý' : 'Processing', color: 'text-violet-600', bg: 'bg-violet-50' },
          { status: 'shipping', label: isVietnamese ? 'Đang giao' : 'Shipping', color: 'text-blue-600', bg: 'bg-blue-50' },
          { status: 'delivered', label: isVietnamese ? 'Đã giao' : 'Delivered', color: 'text-emerald-600', bg: 'bg-emerald-50' },
        ].map(({ status: nextStatusLabel, label, color, bg }) => {
          const count = orders.filter((order) => order.status === nextStatusLabel).length;
          return (
            <button
              key={nextStatusLabel}
              type="button"
              onClick={() => setStatus(nextStatusLabel as OrderStatus)}
              className={`group rounded-2xl border p-4 text-left shadow-sm transition hover:scale-[1.02] hover:shadow-md ${
                status === nextStatusLabel
                  ? 'border-primary bg-primary/5'
                  : `border-on-surface/8 ${bg}`
              }`}
            >
              <p className={`text-3xl font-black ${color}`}>{count}</p>
              <p className="mt-1 text-xs font-semibold text-on-surface-variant">
                {label}
              </p>
            </button>
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
          setTracking(null);
        }}
        size="xl"
        footer={
          selectedOrder ? (
            <div className="flex flex-wrap items-center justify-end gap-3">
              {getAllowedNextStatuses(selectedOrder.status).length === 0 ? (
                <span className="rounded-2xl border border-on-surface/10 bg-surface/60 px-4 py-2.5 text-sm italic text-on-surface-variant/60">
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
                        ? 'Dang cap nhat...'
                        : 'Updating...'
                      : isVietnamese
                        ? 'Cap nhat trang thai'
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
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <DetailCard label={isVietnamese ? 'Mã đơn' : 'Order ID'} value={selectedOrder.id} />
                  <DetailCard
                    label={isVietnamese ? 'Phương thức thanh toán' : 'Payment method'}
                    value={selectedOrder.paymentMethod || '-'}
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
                            {item.quantity} x {currency.format(Number(item.unitPrice))}
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
                              {(item.oldStatus
                                ? getStatusLabel(item.oldStatus, isVietnamese)
                                : '-') +
                                ' -> ' +
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

            <section className="rounded-[1.5rem] border border-on-surface/8 bg-surface/50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.18em] text-on-surface-variant/60">
                    <Navigation size={14} />
                    {isVietnamese ? 'Tracking giao hàng hybrid' : 'Hybrid delivery tracking'}
                  </h3>
                  <p className="mt-2 text-sm text-on-surface-variant">
                    {tracking
                      ? `${TRACKING_MODE_LABELS[tracking.mode]} - ${TRACKING_SOURCE_LABELS[tracking.activeSource]
                      }`
                      : isVietnamese
                        ? 'Chua co du lieu tracking'
                        : 'No tracking data yet'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(['demo', 'live', 'auto_fallback'] as TrackingMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => void handleUpdateTrackingMode(mode)}
                      disabled={modeSaving}
                      className={`rounded-full px-4 py-2 text-sm font-bold transition ${tracking?.mode === mode
                        ? 'bg-primary text-white'
                        : 'border border-on-surface/10 bg-white text-on-surface-variant hover:border-primary/30 hover:text-primary'
                        }`}
                    >
                      {TRACKING_MODE_LABELS[mode]}
                    </button>
                  ))}
                </div>
              </div>

              {trackingLoading ? (
                <div className="py-10 text-center text-on-surface-variant">
                  <LoaderCircle size={18} className="mx-auto animate-spin" />
                </div>
              ) : (
                <>
                  <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                    <div className="space-y-4">
                      <div className="overflow-hidden rounded-2xl border border-on-surface/8 bg-white">
                        <div className="flex items-center justify-between px-4 py-3">
                          <p className="text-xs font-black uppercase tracking-[0.18em] text-on-surface-variant/60">
                            {isVietnamese ? 'Vị trí đang dùng để hiển thị' : 'Active location'}
                          </p>
                          <span className="rounded-full bg-surface px-3 py-1 text-xs font-bold text-on-surface-variant">
                            {tracking ? TRACKING_SOURCE_LABELS[tracking.activeSource] : 'No signal'}
                          </span>
                        </div>
                        <div className="relative bg-slate-100" style={{ height: 280 }}>
                          {activeMapPoint ? (
                            <iframe
                              title="order-tracking-admin-map"
                              width="100%"
                              height="100%"
                              style={{ border: 0 }}
                              src={getMapEmbedUrl(activeMapPoint.latitude, activeMapPoint.longitude)}
                            />
                          ) : (
                            <div className="flex h-full flex-col items-center justify-center gap-2 text-on-surface-variant">
                              <MapPin size={28} className="text-primary/40" />
                              <p className="text-sm">
                                {isVietnamese
                                  ? 'Chua co toa do de hien thi'
                                  : 'No coordinates available'}
                              </p>
                            </div>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-3 border-t border-on-surface/8 px-4 py-3 text-sm sm:grid-cols-4">
                          <InfoPill
                            label={isVietnamese ? 'Lat' : 'Lat'}
                            value={activeMapPoint ? String(activeMapPoint.latitude) : '-'}
                          />
                          <InfoPill
                            label={isVietnamese ? 'Lng' : 'Lng'}
                            value={activeMapPoint ? String(activeMapPoint.longitude) : '-'}
                          />
                          <InfoPill
                            label={isVietnamese ? 'Cập nhật' : 'Updated'}
                            value={activeMapPoint ? formatTrackingTime(activeMapPoint.updatedAt) : '-'}
                          />
                          <InfoPill
                            label={isVietnamese ? 'GPS fresh' : 'GPS fresh'}
                            value={tracking?.gpsSignalFresh ? 'Yes' : 'No'}
                          />
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-3">
                        <button
                          type="button"
                          onClick={() => seedManualFrom('active')}
                          className="rounded-2xl border border-on-surface/10 bg-white px-4 py-3 text-sm font-semibold text-on-surface-variant transition hover:border-primary/30 hover:text-primary"
                        >
                          {isVietnamese ? 'Lấy vị trí đang hiển thị' : 'Use active point'}
                        </button>
                        <button
                          type="button"
                          onClick={() => seedManualFrom('gps')}
                          className="rounded-2xl border border-on-surface/10 bg-white px-4 py-3 text-sm font-semibold text-on-surface-variant transition hover:border-primary/30 hover:text-primary"
                        >
                          {isVietnamese ? 'Lấy từ GPS' : 'Use GPS point'}
                        </button>
                        <button
                          type="button"
                          onClick={() => seedManualFrom('manual')}
                          className="rounded-2xl border border-on-surface/10 bg-white px-4 py-3 text-sm font-semibold text-on-surface-variant transition hover:border-primary/30 hover:text-primary"
                        >
                          {isVietnamese ? 'Lấy từ demo hiện tại' : 'Use manual point'}
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {[
                          { label: 'N', lat: 0.0025, lng: 0 },
                          { label: 'S', lat: -0.0025, lng: 0 },
                          { label: 'E', lat: 0, lng: 0.0025 },
                          { label: 'W', lat: 0, lng: -0.0025 },
                        ].map((item) => (
                          <button
                            key={item.label}
                            type="button"
                            onClick={() => nudgeManual(item.lat, item.lng)}
                            className="rounded-2xl border border-on-surface/10 bg-white px-4 py-3 text-sm font-bold text-on-surface transition hover:border-primary/30 hover:text-primary"
                          >
                            {isVietnamese ? `Dich ${item.label}` : `Move ${item.label}`}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-2xl border border-on-surface/8 bg-white p-4">
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-on-surface-variant/60">
                          {isVietnamese ? 'Nguồn demo / manual' : 'Manual / demo source'}
                        </p>
                        <div className="mt-3 grid gap-3">
                          <input
                            value={manualForm.latitude}
                            onChange={(event) =>
                              setManualForm((current) => ({
                                ...current,
                                latitude: event.target.value,
                              }))
                            }
                            placeholder="Latitude"
                            className="rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none"
                          />
                          <input
                            value={manualForm.longitude}
                            onChange={(event) =>
                              setManualForm((current) => ({
                                ...current,
                                longitude: event.target.value,
                              }))
                            }
                            placeholder="Longitude"
                            className="rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none"
                          />
                          <input
                            value={manualForm.note}
                            onChange={(event) =>
                              setManualForm((current) => ({
                                ...current,
                                note: event.target.value,
                              }))
                            }
                            placeholder={isVietnamese ? 'Ghi chú demo' : 'Manual note'}
                            className="rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => void handleUpdateManualTracking()}
                            disabled={
                              manualSaving ||
                              !manualForm.latitude.trim() ||
                              !manualForm.longitude.trim()
                            }
                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-white transition hover:bg-primary/90 disabled:opacity-50"
                          >
                            {manualSaving ? (
                              <LoaderCircle size={14} className="animate-spin" />
                            ) : (
                              <Save size={14} />
                            )}
                            {isVietnamese ? 'Cập nhật demo' : 'Update manual'}
                          </button>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-on-surface/8 bg-white p-4">
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-on-surface-variant/60">
                          {isVietnamese ? 'Nguồn GPS / live' : 'Live GPS source'}
                        </p>
                        <div className="mt-3 grid gap-3">
                          <input
                            value={liveForm.latitude}
                            onChange={(event) =>
                              setLiveForm((current) => ({
                                ...current,
                                latitude: event.target.value,
                              }))
                            }
                            placeholder="Latitude"
                            className="rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none"
                          />
                          <input
                            value={liveForm.longitude}
                            onChange={(event) =>
                              setLiveForm((current) => ({
                                ...current,
                                longitude: event.target.value,
                              }))
                            }
                            placeholder="Longitude"
                            className="rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none"
                          />
                          <div className="grid gap-3 sm:grid-cols-2">
                            <input
                              value={liveForm.heading}
                              onChange={(event) =>
                                setLiveForm((current) => ({
                                  ...current,
                                  heading: event.target.value,
                                }))
                              }
                              placeholder={isVietnamese ? 'Hướng đi' : 'Heading'}
                              className="rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none"
                            />
                            <input
                              value={liveForm.speedKph}
                              onChange={(event) =>
                                setLiveForm((current) => ({
                                  ...current,
                                  speedKph: event.target.value,
                                }))
                              }
                              placeholder={isVietnamese ? 'Tốc độ kph' : 'Speed kph'}
                              className="rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none"
                            />
                          </div>
                          <input
                            value={liveForm.provider}
                            onChange={(event) =>
                              setLiveForm((current) => ({
                                ...current,
                                provider: event.target.value,
                              }))
                            }
                            placeholder={isVietnamese ? 'Nguồn GPS / thiết bị' : 'GPS provider / device'}
                            className="rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => void handleUpdateLiveTracking()}
                            disabled={
                              liveSaving ||
                              !liveForm.latitude.trim() ||
                              !liveForm.longitude.trim()
                            }
                            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm font-bold text-primary transition hover:bg-primary/15 disabled:opacity-50"
                          >
                            {liveSaving ? (
                              <LoaderCircle size={14} className="animate-spin" />
                            ) : (
                              <Navigation size={14} />
                            )}
                            {isVietnamese ? 'Cập nhật GPS live' : 'Update live GPS'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </section>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function getStatusLabel(status: OrderStatus, isVietnamese: boolean) {
  const labels: Record<OrderStatus, string> = isVietnamese
    ? {
      backordered: 'Chờ hàng',
      pending: 'Chờ xử lý',
      confirmed: 'Đã xác nhận',
      processing: 'Đang xử lý',
      shipping: 'Đang giao',
      delivered: 'Đã giao',
      partial_delivered: 'Giao một phần',
      cancelled: 'Đã hủy',
      returned: 'Đã hoàn',
    }
    : {
      backordered: 'Backordered',
      pending: 'Pending',
      confirmed: 'Confirmed',
      processing: 'Processing',
      shipping: 'Shipping',
      delivered: 'Delivered',
      partial_delivered: 'Partial delivered',
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
    backordered: 'red',
    pending: 'amber',
    confirmed: 'sky',
    processing: 'slate',
    shipping: 'primary',
    delivered: 'emerald',
    partial_delivered: 'amber',
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

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-on-surface-variant/60">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-on-surface">{value}</p>
    </div>
  );
}
