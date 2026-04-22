import { type FC, useEffect, useRef, useState } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Package,
  MapPin,
  CreditCard,
  Leaf,
  CheckCircle2,
  Clock,
  Truck,
  XCircle,
  AlertCircle,
  Star,
  Navigation,
  RefreshCw,
} from 'lucide-react';
import { clientApi } from '../../lib/client-api';
import { useClientSession } from '../../hooks/useClientSession';

type OrderItem = {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

type OrderDetail = {
  id: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  totalPayment: string;
  totalQuantity: number;
  subtotalAmount: string;
  discountAmount: string;
  deliveryCost: string;
  fullName: string;
  phone: string;
  address: string;
  note: string | null;
  createdAt: string;
  items: OrderItem[];
};

const STATUS_STEPS = ['pending', 'confirmed', 'processing', 'shipping', 'delivered'];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: FC<{ size?: number; className?: string }> }> = {
  pending: { label: 'Chờ xử lý', color: '#b45309', bg: '#fef3c7', icon: Clock },
  confirmed: { label: 'Đã xác nhận', color: '#1d4ed8', bg: '#dbeafe', icon: CheckCircle2 },
  processing: { label: 'Đang xử lý', color: '#6d28d9', bg: '#ede9fe', icon: Package },
  shipping: { label: 'Đang giao hàng', color: '#0369a1', bg: '#e0f2fe', icon: Truck },
  delivered: { label: 'Đã giao thành công', color: '#15803d', bg: '#dcfce7', icon: CheckCircle2 },
  cancelled: { label: 'Đã hủy', color: '#dc2626', bg: '#fee2e2', icon: XCircle },
  returned: { label: 'Đã trả hàng', color: '#9f1239', bg: '#ffe4e6', icon: AlertCircle },
};

const PAYMENT_LABELS: Record<string, string> = {
  cod: 'Thanh toán khi nhận hàng (COD)',
  bank_transfer: 'Chuyển khoản ngân hàng',
  momo: 'Ví MoMo',
  vnpay: 'VNPay',
  zalopay: 'ZaloPay',
};

const PAYMENT_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  unpaid: { label: 'Chưa thanh toán', color: '#b45309' },
  paid: { label: 'Đã thanh toán', color: '#15803d' },
  failed: { label: 'Thanh toán thất bại', color: '#dc2626' },
  refunded: { label: 'Đã hoàn tiền', color: '#6d28d9' },
};

function formatPrice(val: number | string) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(val));
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { session } = useClientSession();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapCoords, setMapCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [mapLoading, setMapLoading] = useState(false);
  const geocodedRef = useRef(false);
  const momoVerifiedRef = useRef(false);

  useEffect(() => {
    if (!session) { void navigate('/client/login'); return; }
    if (!id) return;
    setLoading(true);
    void clientApi
      .get<OrderDetail>(`/users/me/orders/${id}`)
      .then((data) => setOrder(data))
      .catch(() => { void navigate('/client/orders'); })
      .finally(() => setLoading(false));
  }, [session, id, navigate]);

  // Handle MoMo redirect: verify payment result and refresh order
  useEffect(() => {
    const resultCode = searchParams.get('resultCode');
    const requestId = searchParams.get('requestId');
    if (resultCode === null || !requestId || momoVerifiedRef.current) return;
    momoVerifiedRef.current = true;

    void clientApi
      .post('/payments/momo/verify', {
        orderId: searchParams.get('orderId'),
        requestId,
        resultCode: Number(resultCode),
        transId: searchParams.get('transId') ? Number(searchParams.get('transId')) : undefined,
        amount: searchParams.get('amount') ? Number(searchParams.get('amount')) : undefined,
        message: searchParams.get('message') ?? '',
        partnerCode: searchParams.get('partnerCode') ?? '',
        orderInfo: searchParams.get('orderInfo') ?? '',
        orderType: searchParams.get('orderType') ?? '',
        payType: searchParams.get('payType') ?? '',
        extraData: searchParams.get('extraData') ?? '',
        signature: searchParams.get('signature') ?? '',
      })
      .then(() => {
        if (id) {
          void clientApi
            .get<OrderDetail>(`/users/me/orders/${id}`)
            .then((data) => setOrder(data))
            .catch(() => {});
        }
      })
      .catch(() => {})
      .finally(() => {
        setSearchParams({}, { replace: true });
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Geocode delivery address when order is in shipping/delivered status
  useEffect(() => {
    if (!order || geocodedRef.current) return;
    if (order.status !== 'shipping' && order.status !== 'delivered') return;
    if (!order.address) return;
    geocodedRef.current = true;
    setMapLoading(true);
    const query = encodeURIComponent(`${order.address}, Việt Nam`);
    fetch(`https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&accept-language=vi`)
      .then((r) => r.json())
      .then((data: Array<{ lat: string; lon: string }>) => {
        if (data[0]) {
          setMapCoords({ lat: Number(data[0].lat), lng: Number(data[0].lon) });
        }
      })
      .catch(() => {})
      .finally(() => setMapLoading(false));
  }, [order]);

  if (loading) {
    return (
      <div style={{ background: '#f2f0eb', minHeight: '60vh' }} className="flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#006241] border-t-transparent" />
      </div>
    );
  }

  if (!order) return null;

  const statusInfo = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending;
  const StatusIcon = statusInfo.icon;
  const isCancelled = order.status === 'cancelled' || order.status === 'returned';
  const isDelivered = order.status === 'delivered';
  const currentStepIdx = STATUS_STEPS.indexOf(order.status);
  const shortId = order.id.slice(-8).toUpperCase();
  const paymentStatusInfo = PAYMENT_STATUS_LABELS[order.paymentStatus] ?? { label: order.paymentStatus, color: '#374151' };

  return (
    <div style={{ background: '#f2f0eb', minHeight: '80vh' }}>
      <div className="mx-auto max-w-4xl px-4 py-10 lg:px-6">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              to="/client/orders"
              className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-[#006241] hover:underline"
            >
              <ArrowLeft size={14} /> Lịch sử đơn hàng
            </Link>
            <h1 className="text-2xl font-black text-[#1E3932]">Đơn hàng #{shortId}</h1>
            <p className="mt-1 text-xs text-gray-400">{formatDate(order.createdAt)}</p>
          </div>
          <div
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-black"
            style={{ background: statusInfo.bg, color: statusInfo.color }}
          >
            <StatusIcon size={16} />
            {statusInfo.label}
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
          <div className="space-y-5">
            {/* Delivery tracking map — shown when shipping or delivered */}
            {(order.status === 'shipping' || order.status === 'delivered') && (
              <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
                <div className="flex items-center justify-between px-5 pt-5 pb-3">
                  <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-gray-400">
                    <Navigation size={13} /> Theo dõi giao hàng
                  </h3>
                  {order.status === 'shipping' && (
                    <span className="flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-600">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
                      Đang vận chuyển
                    </span>
                  )}
                  {order.status === 'delivered' && (
                    <span className="flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-600">
                      <CheckCircle2 size={12} />
                      Đã giao thành công
                    </span>
                  )}
                </div>

                {/* Map */}
                <div className="relative mx-5 mb-5 overflow-hidden rounded-xl bg-gray-100" style={{ height: 240 }}>
                  {mapLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
                      <RefreshCw size={20} className="animate-spin text-gray-400" />
                    </div>
                  )}
                  {mapCoords && !mapLoading && (
                    <iframe
                      title="delivery-map"
                      width="100%"
                      height="100%"
                      style={{ border: 0 }}
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${mapCoords.lng - 0.05},${mapCoords.lat - 0.05},${mapCoords.lng + 0.05},${mapCoords.lat + 0.05}&layer=mapnik&marker=${mapCoords.lat},${mapCoords.lng}`}
                    />
                  )}
                  {!mapCoords && !mapLoading && (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-gray-400">
                      <MapPin size={28} />
                      <p className="text-xs">Không thể tải bản đồ</p>
                    </div>
                  )}
                  {/* Destination pin overlay */}
                  {mapCoords && !mapLoading && (
                    <div className="absolute bottom-2 left-2 rounded-lg bg-white/90 px-3 py-1.5 text-xs font-semibold text-[#1E3932] shadow backdrop-blur">
                      <span className="mr-1.5">📍</span>
                      {order.address.split(',').slice(-2).join(',').trim()}
                    </div>
                  )}
                </div>

                {/* Tracking info row */}
                <div className="grid grid-cols-3 divide-x divide-black/5 border-t border-black/5">
                  <div className="px-4 py-3 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Đơn hàng</p>
                    <p className="mt-0.5 text-sm font-black text-[#1E3932]">#{order.id.slice(-6).toUpperCase()}</p>
                  </div>
                  <div className="px-4 py-3 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Trạng thái</p>
                    <p className="mt-0.5 text-sm font-black" style={{ color: statusInfo.color }}>
                      {statusInfo.label}
                    </p>
                  </div>
                  <div className="px-4 py-3 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Địa chỉ</p>
                    <p className="mt-0.5 line-clamp-1 text-xs font-semibold text-[#1E3932]">
                      {order.address.split(',').slice(-1)[0]?.trim() ?? order.address}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Status timeline */}
            {!isCancelled && (
              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <h3 className="mb-5 text-sm font-black uppercase tracking-wider text-gray-400">
                  Trạng thái đơn hàng
                </h3>
                <div className="relative">
                  {/* Track line */}
                  <div className="absolute left-[15px] top-4 bottom-4 w-0.5 bg-black/8" />
                  <div className="space-y-5">
                    {STATUS_STEPS.map((step, idx) => {
                      const cfg = STATUS_CONFIG[step];
                      const StepIcon = cfg.icon;
                      const isDone = currentStepIdx >= idx;
                      const isCurrent = currentStepIdx === idx;
                      return (
                        <div key={step} className="relative flex items-start gap-4 pl-9">
                          <div
                            className="absolute left-0 flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all"
                            style={{
                              background: isDone ? '#006241' : 'white',
                              borderColor: isDone ? '#006241' : '#e5e7eb',
                            }}
                          >
                            <StepIcon size={14} className={isDone ? 'text-white' : 'text-gray-300'} />
                          </div>
                          <div className={`pb-1 ${!isCurrent ? 'opacity-60' : ''}`}>
                            <p className={`text-sm font-bold ${isDone ? 'text-[#1E3932]' : 'text-gray-400'}`}>
                              {cfg.label}
                            </p>
                            {isCurrent && (
                              <p className="text-xs text-[#006241]">Trạng thái hiện tại</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Products */}
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-sm font-black uppercase tracking-wider text-gray-400">
                Sản phẩm đã đặt
              </h3>
              <div className="space-y-4">
                {order.items.map((item) => (
                  <div key={item.id} className="flex items-start gap-4">
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                      style={{ background: '#d4e9e2' }}
                    >
                      <Leaf size={20} style={{ color: '#006241' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link
                        to={`/client/products/${item.productId}`}
                        className="text-sm font-semibold text-[#1E3932] hover:text-[#006241] line-clamp-2"
                      >
                        {item.productName}
                      </Link>
                      <p className="text-xs text-gray-400">
                        {formatPrice(item.unitPrice)} × {item.quantity}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-black text-[#006241]">
                      {formatPrice(item.lineTotal)}
                    </p>
                    {isDelivered && (
                      <Link
                        to={`/client/products/${item.productId}#reviews`}
                        className="shrink-0 flex items-center gap-1 rounded-full border border-[#006241]/20 px-2.5 py-1 text-[11px] font-semibold text-[#006241] transition hover:bg-[#006241]/10"
                      >
                        <Star size={10} /> Đánh giá
                      </Link>
                    )}
                  </div>
                ))}
              </div>

              {/* Price breakdown */}
              <div className="mt-5 space-y-2 border-t border-black/5 pt-4 text-sm">
                <div className="flex justify-between text-gray-500">
                  <span>Tạm tính</span>
                  <span>{formatPrice(order.subtotalAmount)}</span>
                </div>
                {Number(order.discountAmount) > 0 && (
                  <div className="flex justify-between text-[#c82014]">
                    <span>Giảm giá</span>
                    <span>−{formatPrice(order.discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-gray-500">
                  <span>Phí vận chuyển</span>
                  <span>{Number(order.deliveryCost) === 0 ? 'Miễn phí' : formatPrice(order.deliveryCost)}</span>
                </div>
                <div className="flex justify-between border-t border-black/5 pt-2 text-base font-black">
                  <span className="text-[#1E3932]">Tổng thanh toán</span>
                  <span className="text-[#006241]">{formatPrice(order.totalPayment)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Shipping info */}
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <h3 className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-gray-400">
                <MapPin size={13} /> Địa chỉ giao hàng
              </h3>
              <p className="text-sm font-semibold text-[#1E3932]">{order.fullName}</p>
              <p className="text-sm text-gray-500">{order.phone}</p>
              <p className="mt-1 text-sm text-gray-600">{order.address}</p>
            </div>

            {/* Payment info */}
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <h3 className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-gray-400">
                <CreditCard size={13} /> Thanh toán
              </h3>
              <p className="text-sm text-[#1E3932]">{PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod}</p>
              <p className="mt-1 text-xs font-bold" style={{ color: paymentStatusInfo.color }}>
                {paymentStatusInfo.label}
              </p>
            </div>

            {/* Note */}
            {order.note && (
              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <h3 className="mb-2 text-xs font-black uppercase tracking-wider text-gray-400">Ghi chú</h3>
                <p className="text-sm text-gray-600">{order.note}</p>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-2">
              {order.status === 'pending' && (
                <button
                  onClick={async () => {
                    if (!confirm('Bạn có chắc muốn hủy đơn hàng này?')) return;
                    try {
                      await clientApi.patch(`/orders/${order.id}/cancel`);
                      setOrder((prev) => prev ? { ...prev, status: 'cancelled' } : prev);
                    } catch (err) {
                      alert(err instanceof Error ? err.message : 'Không thể hủy đơn hàng');
                    }
                  }}
                  className="w-full rounded-full border border-red-200 py-2.5 text-sm font-bold text-red-600 transition hover:bg-red-50 active:scale-95"
                >
                  Hủy đơn hàng
                </button>
              )}
              <Link
                to="/client/products"
                className="flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-sm font-bold text-white transition active:scale-95"
                style={{ background: '#00754A' }}
              >
                <Leaf size={15} /> Tiếp tục mua sắm
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
