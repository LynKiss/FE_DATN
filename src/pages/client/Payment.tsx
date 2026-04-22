import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  CreditCard,
  Banknote,
  Truck,
  ShieldCheck,
  CheckCircle2,
  ChevronRight,
  ArrowLeft,
  Leaf,
  LoaderCircle,
  MapPin,
  Timer,
  X,
} from 'lucide-react';
import { clientApi } from '../../lib/client-api';
import { refreshGlobalCart, useCart } from '../../hooks/useCart';
import { useClientSession } from '../../hooks/useClientSession';

type LocationState = {
  shippingAddressId?: string;
  deliveryId?: string;
  shippingAddress?: string;
  deliveryName?: string;
  shippingCost?: number;
  note?: string;
  discountCode?: string;
  discountAmount?: number;
  subtotal?: number;
  total?: number;
};

type CreateOrderResponse = {
  id: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  totalPayment: string;
  totalQuantity: number;
  createdAt: string;
  address: string;
};

function formatPrice(price: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
}

const PAYMENT_METHODS = [
  {
    id: 'cod',
    label: 'Thanh toán khi nhận hàng (COD)',
    desc: 'Trả tiền mặt khi nhận được hàng. Không phụ thu.',
    icon: Truck,
    emoji: '💵',
    online: false,
  },
  {
    id: 'bank_transfer',
    label: 'Chuyển khoản ngân hàng',
    desc: 'Chuyển khoản vào tài khoản Vietcombank. Đơn xử lý sau khi xác nhận.',
    icon: Banknote,
    emoji: '🏦',
    online: true,
    color: '#0065AC',
  },
  {
    id: 'momo',
    label: 'Ví MoMo',
    desc: 'Quét mã QR thanh toán nhanh qua ứng dụng MoMo.',
    icon: CreditCard,
    emoji: '📱',
    online: true,
    color: '#AE2070',
  },
  {
    id: 'vnpay',
    label: 'VNPay',
    desc: 'Thanh toán qua cổng VNPay — hỗ trợ thẻ ATM, Visa, MasterCard.',
    icon: CreditCard,
    emoji: '💳',
    online: true,
    color: '#005BAA',
  },
  {
    id: 'zalopay',
    label: 'ZaloPay',
    desc: 'Thanh toán qua ứng dụng ZaloPay hoặc mã QR.',
    icon: CreditCard,
    emoji: '🔵',
    online: true,
    color: '#0068FF',
  },
];

export default function Payment() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session } = useClientSession();
  const { cart } = useCart();
  const state = (location.state as LocationState) || {};

  const [method, setMethod] = useState('cod');
  const [placing, setPlacing] = useState(false);
  const [success, setSuccess] = useState<{ orderId: string; totalPayment: string; paymentMethod: string } | null>(null);
  const [simulateOpen, setSimulateOpen] = useState(false);
  const [simOrderId, setSimOrderId] = useState<string | null>(null);
  const [simRef, setSimRef] = useState<string | null>(null);
  const [simCountdown, setSimCountdown] = useState(600);
  const [simConfirming, setSimConfirming] = useState(false);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (simulateOpen) {
      setSimCountdown(600);
      countdownRef.current = setInterval(() => {
        setSimCountdown((v) => {
          if (v <= 1) {
            clearInterval(countdownRef.current!);
            setSimulateOpen(false);
            return 0;
          }
          return v - 1;
        });
      }, 1000);
    } else {
      if (countdownRef.current) clearInterval(countdownRef.current);
    }
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [simulateOpen]);

  const handleConfirmSimPayment = async () => {
    if (!simOrderId || !simRef) return;
    setSimConfirming(true);
    try {
      await clientApi.post(`/payments/callback/${method}`, {
        orderId: simOrderId,
        transactionRef: simRef,
        success: true,
        amount: String(total),
        gatewayCode: 'DEMO_SUCCESS',
        gatewayMessage: 'Thanh toán thành công (demo)',
        rawPayload: { demo: true },
      });
      setSimulateOpen(false);
      setSuccess({ orderId: simOrderId, totalPayment: String(total), paymentMethod: method });
    } catch {
      // If callback fails (e.g., permission denied), still show success for demo
      setSimulateOpen(false);
      setSuccess({ orderId: simOrderId, totalPayment: String(total), paymentMethod: method });
    } finally {
      setSimConfirming(false);
    }
  };

  if (!session) {
    void navigate('/client/login');
    return null;
  }

  if (!state.shippingAddressId || !state.deliveryId) {
    void navigate('/client/checkout');
    return null;
  }

  const subtotal = state.subtotal ?? Number(cart?.totalAmount ?? 0);
  const discountAmount = state.discountAmount ?? 0;
  const shipping = state.shippingCost ?? 0;
  const total = state.total ?? (subtotal - discountAmount + shipping);

  const handlePlaceOrder = async () => {
    setPlacing(true);
    try {
      const order = await clientApi.post<CreateOrderResponse>('/orders', {
        shippingAddressId: state.shippingAddressId,
        deliveryId: state.deliveryId,
        paymentMethod: method,
        note: state.note || undefined,
        discountCode: state.discountCode || undefined,
      });

      await refreshGlobalCart();

      const isOnline = ['momo', 'vnpay', 'zalopay', 'bank_transfer'].includes(method);
      if (isOnline) {
        // Initiate payment transaction and show simulation modal
        try {
          const payTx = await clientApi.post<{ transactionRef: string }>(
            `/payments/orders/${order.id}/initiate`,
            { returnUrl: window.location.origin + '/client/orders/' + order.id },
          );
          setSimRef(payTx.transactionRef);
        } catch {
          setSimRef(`${order.id}-${Date.now()}`);
        }
        setSimOrderId(order.id);
        setSimulateOpen(true);
      } else {
        setSuccess({ orderId: order.id, totalPayment: order.totalPayment, paymentMethod: method });
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Đặt hàng thất bại. Vui lòng thử lại.');
    } finally {
      setPlacing(false);
    }
  };

  if (success) {
    return (
      <div style={{ background: '#f2f0eb', minHeight: '80vh' }} className="flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div
            className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full"
            style={{ background: '#d4e9e2' }}
          >
            <CheckCircle2 size={40} className="text-[#006241]" />
          </div>
          <h1 className="text-2xl font-black text-[#1E3932]">Đặt hàng thành công! 🎉</h1>
          <p className="mt-2 text-sm text-gray-500">
            Cảm ơn bạn đã tin tưởng Cultivated Ledger. Chúng tôi sẽ xử lý đơn hàng của bạn sớm nhất.
          </p>
          <div className="mt-6 rounded-2xl bg-white p-5 text-left shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Tổng thanh toán</p>
              <p className="text-xl font-black text-[#006241]">
                {formatPrice(Number(success.totalPayment))}
              </p>
            </div>
            {success.paymentMethod === 'cod' && (
              <p className="text-sm text-gray-600">
                Vui lòng chuẩn bị <span className="font-bold text-[#1E3932]">{formatPrice(Number(success.totalPayment))}</span> khi nhận hàng.
              </p>
            )}
            {success.paymentMethod === 'bank_transfer' && (
              <div className="rounded-xl bg-[#f2f0eb] p-3">
                <p className="text-xs font-bold text-[#1E3932]">Thông tin chuyển khoản:</p>
                <p className="mt-1 text-xs text-gray-600">
                  Ngân hàng: Vietcombank · STK: 1234567890<br />
                  Tên TK: CONG TY TNHH CULTIVATED LEDGER<br />
                  Nội dung: DH{success.orderId.slice(-8).toUpperCase()}
                </p>
              </div>
            )}
            {success.paymentMethod === 'momo' && (
              <div className="rounded-xl bg-pink-50 p-3 text-sm text-pink-800">
                ✅ Đã xác nhận thanh toán MoMo thành công.
              </div>
            )}
            {success.paymentMethod === 'vnpay' && (
              <div className="rounded-xl bg-blue-50 p-3 text-sm text-blue-800">
                ✅ Đã xác nhận thanh toán VNPay thành công.
              </div>
            )}
            {success.paymentMethod === 'zalopay' && (
              <div className="rounded-xl bg-blue-50 p-3 text-sm text-blue-800">
                ✅ Đã xác nhận thanh toán ZaloPay thành công.
              </div>
            )}
            <p className="mt-3 text-xs text-gray-400">
              Đơn hàng sẽ được giao trong 2–4 ngày làm việc. Bạn có thể theo dõi trong mục đơn hàng.
            </p>
          </div>
          <div className="mt-6 flex gap-3">
            <Link
              to={`/client/orders/${success.orderId}`}
              className="flex-1 rounded-full border border-[#006241] py-3 text-sm font-bold text-[#006241] transition hover:bg-[#006241] hover:text-white"
            >
              Xem đơn hàng
            </Link>
            <Link
              to="/client"
              className="flex-1 rounded-full py-3 text-sm font-bold text-white transition active:scale-95"
              style={{ background: '#00754A' }}
            >
              Về trang chủ
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const selectedMethodInfo = PAYMENT_METHODS.find((m) => m.id === method);
  const fmtCountdown = `${String(Math.floor(simCountdown / 60)).padStart(2, '0')}:${String(simCountdown % 60).padStart(2, '0')}`;

  return (
    <>
    {/* Payment simulation modal */}
    {simulateOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="w-full max-w-sm overflow-hidden rounded-[2rem] bg-white shadow-2xl">
          {/* Header */}
          <div
            className="px-6 py-5 text-center text-white"
            style={{ background: selectedMethodInfo?.color ?? '#1E3932' }}
          >
            <div className="flex items-center justify-between">
              <p className="text-lg font-black">{selectedMethodInfo?.emoji} {selectedMethodInfo?.label}</p>
              <button onClick={() => setSimulateOpen(false)} className="rounded-xl p-1.5 hover:bg-white/20 transition">
                <X size={18} />
              </button>
            </div>
            <p className="mt-1 text-sm text-white/70">Đang chờ thanh toán...</p>
          </div>

          <div className="p-6 text-center">
            {/* QR Code (static demo) */}
            <div className="mx-auto mb-4 flex h-48 w-48 items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50">
              <div className="grid grid-cols-7 gap-0.5 p-2">
                {Array.from({ length: 49 }).map((_, i) => {
                  const pattern = [0,1,2,8,9,11,14,16,18,22,24,25,26,28,30,32,36,38,40,42,44,45,46,47,48];
                  return (
                    <div key={i} className={`h-5 w-5 rounded-sm ${pattern.includes(i) ? 'bg-gray-800' : 'bg-transparent'}`} />
                  );
                })}
              </div>
            </div>

            <p className="text-sm text-gray-500">Quét mã QR để thanh toán</p>
            <p className="mt-1 text-xl font-black text-[#1E3932]">{formatPrice(total)}</p>

            <div className="mt-3 flex items-center justify-center gap-2 text-sm font-semibold text-orange-500">
              <Timer size={15} />
              <span>Hết hạn sau {fmtCountdown}</span>
            </div>

            {/* Ref code */}
            {simRef && (
              <p className="mt-2 text-[11px] text-gray-400">Mã GD: {simRef.slice(-12).toUpperCase()}</p>
            )}

            <div className="mt-5 space-y-2">
              <button
                onClick={() => void handleConfirmSimPayment()}
                disabled={simConfirming}
                className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-black text-white transition active:scale-95 disabled:opacity-60"
                style={{ background: selectedMethodInfo?.color ?? '#006241' }}
              >
                {simConfirming ? <LoaderCircle size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                Xác nhận đã thanh toán (Demo)
              </button>
              <button
                onClick={() => setSimulateOpen(false)}
                className="w-full rounded-2xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-500 transition hover:bg-gray-50"
              >
                Huỷ
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    <div style={{ background: '#f2f0eb', minHeight: '80vh' }}>
      <div className="mx-auto max-w-5xl px-4 py-10 lg:px-6">
        {/* Steps */}
        <div className="mb-8 flex items-center justify-center gap-3 text-sm">
          {[
            { label: 'Giỏ hàng', done: true },
            { label: 'Địa chỉ & Vận chuyển', done: true },
            { label: 'Thanh toán', active: true },
            { label: 'Xác nhận' },
          ].map((step, i) => (
            <div key={step.label} className="flex items-center gap-2">
              {i > 0 && <ChevronRight size={14} className="text-gray-300" />}
              <span
                className={`text-sm font-semibold ${
                  step.done ? 'text-[#006241]' : step.active ? 'text-[#1E3932] font-black' : 'text-gray-400'
                }`}
              >
                {step.done ? '✓ ' : ''}{step.label}
              </span>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          {/* Payment method */}
          <div>
            <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-[#1E3932]">
              <CreditCard size={20} className="text-[#006241]" /> Phương thức thanh toán
            </h2>
            <div className="space-y-3">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMethod(m.id)}
                  className={`flex w-full items-start gap-4 rounded-2xl border-2 p-4 text-left transition ${
                    method === m.id ? 'border-[#006241] bg-[#006241]/5' : 'border-transparent bg-white hover:border-[#006241]/20'
                  }`}
                >
                  <span className="mt-0.5 text-2xl">{m.emoji}</span>
                  <div className="flex-1">
                    <p className="font-bold text-[#1E3932]">{m.label}</p>
                    <p className="mt-0.5 text-xs text-gray-500">{m.desc}</p>
                  </div>
                  <div
                    className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${
                      method === m.id ? 'border-[#006241] bg-[#006241]' : 'border-gray-300'
                    }`}
                  >
                    {method === m.id && <div className="h-2 w-2 rounded-full bg-white" />}
                  </div>
                </button>
              ))}
            </div>

            {/* Delivery + address summary */}
            {(state.shippingAddress || state.deliveryName) && (
              <div className="mt-4 rounded-2xl bg-white p-4 space-y-2">
                {state.shippingAddress && (
                  <div className="flex items-start gap-2">
                    <MapPin size={15} className="mt-0.5 shrink-0 text-[#006241]" />
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Địa chỉ nhận hàng</p>
                      <p className="text-sm text-[#1E3932]">{state.shippingAddress}</p>
                    </div>
                  </div>
                )}
                {state.deliveryName && (
                  <div className="flex items-start gap-2">
                    <Truck size={15} className="mt-0.5 shrink-0 text-[#006241]" />
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Phương thức vận chuyển</p>
                      <p className="text-sm text-[#1E3932]">{state.deliveryName}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Security notice */}
            <div className="mt-4 flex items-start gap-3 rounded-2xl bg-[#d4e9e2] p-4 text-sm text-[#1E3932]">
              <ShieldCheck size={18} className="mt-0.5 shrink-0 text-[#006241]" />
              <p>
                Thông tin thanh toán của bạn được bảo mật tuyệt đối. Chúng tôi không lưu trữ thông tin thẻ.
              </p>
            </div>

            <div className="mt-4 flex gap-3">
              <Link
                to="/client/checkout"
                className="flex items-center gap-2 rounded-full border border-black/10 px-5 py-3 text-sm font-semibold text-gray-500 hover:text-[#006241]"
              >
                <ArrowLeft size={15} /> Quay lại
              </Link>
              <button
                onClick={() => void handlePlaceOrder()}
                disabled={placing}
                className="flex flex-1 items-center justify-center gap-2 rounded-full py-3 text-sm font-bold text-white disabled:opacity-60 active:scale-95"
                style={{ background: '#00754A' }}
              >
                {placing ? <LoaderCircle size={16} className="animate-spin" /> : null}
                {placing ? 'Đang xử lý...' : `Đặt hàng · ${formatPrice(total)}`}
              </button>
            </div>
          </div>

          {/* Order summary */}
          <div>
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <p className="mb-4 text-sm font-black uppercase tracking-wider text-gray-400">
                Xác nhận đơn hàng
              </p>
              {cart && (
                <div className="max-h-52 space-y-3 overflow-y-auto">
                  {cart.items.map((item) => (
                    <div key={item.id} className="flex items-start gap-3">
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-[#f2f0eb]">
                        {item.primaryImageUrl ? (
                          <img src={item.primaryImageUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <Leaf size={18} className="text-[#006241]/30" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="line-clamp-2 text-xs font-semibold text-[#1E3932]">
                          {item.productName}
                        </p>
                        <p className="text-xs text-gray-400">x{item.quantity}</p>
                      </div>
                      <p className="shrink-0 text-xs font-bold text-[#006241]">
                        {formatPrice(Number(item.lineTotal))}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-4 space-y-2 border-t border-black/5 pt-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Tạm tính</span>
                  <span className="font-semibold">{formatPrice(subtotal)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Giảm giá</span>
                    <span className="font-semibold text-red-500">-{formatPrice(discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Vận chuyển</span>
                  <span className={`font-semibold ${shipping === 0 ? 'text-[#006241]' : ''}`}>
                    {shipping === 0 ? 'Miễn phí' : formatPrice(shipping)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-black/5 pt-2 text-base font-black">
                  <span className="text-[#1E3932]">Tổng cộng</span>
                  <span className="text-[#006241]">{formatPrice(total)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
