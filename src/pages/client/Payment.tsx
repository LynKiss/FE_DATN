import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Banknote,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Leaf,
  LoaderCircle,
  MapPin,
  ShieldCheck,
  Timer,
  Truck,
  X,
} from 'lucide-react';
import {
  DEFAULT_PUBLIC_PAYMENT_SETTINGS,
  PaymentMethodKey,
  PublicCommerceSettings,
  PublicPaymentSettings,
} from '../../lib/commerce-settings';
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

const PAYMENT_METHODS: Array<{
  id: PaymentMethodKey;
  label: string;
  desc: string;
  icon: typeof Truck;
  emoji: string;
  online: boolean;
  color?: string;
}> = [
  {
    id: 'cod',
    label: 'Thanh toan khi nhan hang (COD)',
    desc: 'Tra tien mat khi nhan duoc hang. Khong phu thu.',
    icon: Truck,
    emoji: '💵',
    online: false,
  },
  {
    id: 'bank_transfer',
    label: 'Chuyen khoan ngan hang',
    desc: 'Chuyen khoan va doi doi chieu giao dich.',
    icon: Banknote,
    emoji: '🏦',
    online: true,
    color: '#0065AC',
  },
  {
    id: 'momo',
    label: 'Vi MoMo',
    desc: 'Quet ma QR thanh toan nhanh qua ung dung MoMo.',
    icon: CreditCard,
    emoji: '📱',
    online: true,
    color: '#AE2070',
  },
  {
    id: 'vnpay',
    label: 'VNPay',
    desc: 'Thanh toan qua cong VNPay.',
    icon: CreditCard,
    emoji: '💳',
    online: true,
    color: '#005BAA',
  },
  {
    id: 'zalopay',
    label: 'ZaloPay',
    desc: 'Thanh toan qua ung dung ZaloPay hoac ma QR.',
    icon: CreditCard,
    emoji: '🔵',
    online: true,
    color: '#0068FF',
  },
];

function formatPrice(price: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(price);
}

function mergePublicPaymentSettings(
  settings?: Partial<PublicPaymentSettings> | null,
): PublicPaymentSettings {
  return {
    ...DEFAULT_PUBLIC_PAYMENT_SETTINGS,
    ...(settings ?? {}),
    bank_transfer: {
      ...DEFAULT_PUBLIC_PAYMENT_SETTINGS.bank_transfer,
      ...(settings?.bank_transfer ?? {}),
    },
  };
}

export default function Payment() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session } = useClientSession();
  const { cart } = useCart();
  const state = (location.state as LocationState) || {};

  const [method, setMethod] = useState<PaymentMethodKey>('cod');
  const [placing, setPlacing] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [paymentSettings, setPaymentSettings] = useState<PublicPaymentSettings>(
    DEFAULT_PUBLIC_PAYMENT_SETTINGS,
  );
  const [success, setSuccess] = useState<{
    orderId: string;
    totalPayment: string;
    paymentMethod: PaymentMethodKey;
  } | null>(null);
  const [simulateOpen, setSimulateOpen] = useState(false);
  const [simOrderId, setSimOrderId] = useState<string | null>(null);
  const [simRef, setSimRef] = useState<string | null>(null);
  const [simCountdown, setSimCountdown] = useState(600);
  const [simConfirming, setSimConfirming] = useState(false);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingSettings(true);

    void clientApi
      .get<PublicCommerceSettings>('/settings/public/commerce')
      .then((data) => {
        if (!cancelled) {
          setPaymentSettings(mergePublicPaymentSettings(data.payments));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) {
          setLoadingSettings(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const availableMethods = PAYMENT_METHODS.filter(
    (paymentMethod) => paymentSettings[paymentMethod.id]?.isActive,
  );

  useEffect(() => {
    if (!availableMethods.length) {
      return;
    }

    if (!availableMethods.some((paymentMethod) => paymentMethod.id === method)) {
      setMethod(availableMethods[0].id);
    }
  }, [availableMethods, method]);

  useEffect(() => {
    if (simulateOpen) {
      setSimCountdown(600);
      countdownRef.current = setInterval(() => {
        setSimCountdown((current) => {
          if (current <= 1) {
            if (countdownRef.current) {
              clearInterval(countdownRef.current);
            }
            setSimulateOpen(false);
            return 0;
          }
          return current - 1;
        });
      }, 1000);
    } else if (countdownRef.current) {
      clearInterval(countdownRef.current);
    }

    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, [simulateOpen]);

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
  const total = state.total ?? subtotal - discountAmount + shipping;

  const handleConfirmSimPayment = async () => {
    if (!simOrderId || !simRef) {
      return;
    }

    setSimConfirming(true);
    try {
      await clientApi.post(`/payments/callback/${method}`, {
        orderId: simOrderId,
        transactionRef: simRef,
        success: true,
        amount: String(total),
        gatewayCode: 'DEMO_SUCCESS',
        gatewayMessage: 'Thanh toan thanh cong (demo)',
        rawPayload: { demo: true },
      });
      setSimulateOpen(false);
      setSuccess({
        orderId: simOrderId,
        totalPayment: String(total),
        paymentMethod: method,
      });
    } catch {
      setSimulateOpen(false);
      setSuccess({
        orderId: simOrderId,
        totalPayment: String(total),
        paymentMethod: method,
      });
    } finally {
      setSimConfirming(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (!availableMethods.length) {
      alert('Hien tai khong co phuong thuc thanh toan nao kha dung.');
      return;
    }

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

      const selectedMethod = PAYMENT_METHODS.find(
        (paymentMethod) => paymentMethod.id === method,
      );
      if (selectedMethod?.online) {
        try {
          const returnUrl = `${window.location.origin}/client/orders/${order.id}`;
          const paymentTransaction = await clientApi.post<{
            transactionRef: string;
            paymentUrl: string;
          }>(`/payments/orders/${order.id}/initiate`, { returnUrl });

          if (
            paymentTransaction.paymentUrl &&
            !paymentTransaction.paymentUrl.includes('payment-gateway.local')
          ) {
            window.location.href = paymentTransaction.paymentUrl;
            return;
          }

          setSimRef(paymentTransaction.transactionRef);
        } catch {
          setSimRef(`${order.id}-${Date.now()}`);
        }

        setSimOrderId(order.id);
        setSimulateOpen(true);
      } else {
        setSuccess({
          orderId: order.id,
          totalPayment: order.totalPayment,
          paymentMethod: method,
        });
      }
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : 'Dat hang that bai. Vui long thu lai.',
      );
    } finally {
      setPlacing(false);
    }
  };

  const selectedMethodInfo =
    availableMethods.find((paymentMethod) => paymentMethod.id === method) ??
    PAYMENT_METHODS.find((paymentMethod) => paymentMethod.id === method);
  const bankTransferConfig = paymentSettings.bank_transfer;
  const fmtCountdown = `${String(Math.floor(simCountdown / 60)).padStart(
    2,
    '0',
  )}:${String(simCountdown % 60).padStart(2, '0')}`;

  if (success) {
    return (
      <div
        style={{ background: '#f2f0eb', minHeight: '80vh' }}
        className="flex items-center justify-center px-4"
      >
        <div className="w-full max-w-md text-center">
          <div
            className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full"
            style={{ background: '#d4e9e2' }}
          >
            <CheckCircle2 size={40} className="text-[#006241]" />
          </div>
          <h1 className="text-2xl font-black text-[#1E3932]">
            Dat hang thanh cong!
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Cam on ban da tin tuong Cultivated Ledger. Chung toi se xu ly don
            hang cua ban som nhat.
          </p>

          <div className="mt-6 rounded-2xl bg-white p-5 text-left shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Tong thanh toan
              </p>
              <p className="text-xl font-black text-[#006241]">
                {formatPrice(Number(success.totalPayment))}
              </p>
            </div>

            {success.paymentMethod === 'cod' && (
              <p className="text-sm text-gray-600">
                Vui long chuan bi{' '}
                <span className="font-bold text-[#1E3932]">
                  {formatPrice(Number(success.totalPayment))}
                </span>{' '}
                khi nhan hang.
              </p>
            )}

            {success.paymentMethod === 'bank_transfer' && (
              <div className="rounded-xl bg-[#f2f0eb] p-3">
                <p className="text-xs font-bold text-[#1E3932]">
                  Thong tin chuyen khoan:
                </p>
                <p className="mt-1 text-xs text-gray-600">
                  Ngan hang: {bankTransferConfig.bankName || 'Dang cap nhat'}
                  <br />
                  STK:{' '}
                  {bankTransferConfig.accountNumber || 'Dang cap nhat'}
                  <br />
                  Chu TK:{' '}
                  {bankTransferConfig.accountHolder || 'Dang cap nhat'}
                  <br />
                  Noi dung: DH{success.orderId.slice(-8).toUpperCase()}
                </p>
              </div>
            )}

            {success.paymentMethod === 'momo' && (
              <div className="rounded-xl bg-pink-50 p-3 text-sm text-pink-800">
                Da xac nhan thanh toan MoMo thanh cong.
              </div>
            )}
            {success.paymentMethod === 'vnpay' && (
              <div className="rounded-xl bg-blue-50 p-3 text-sm text-blue-800">
                Da xac nhan thanh toan VNPay thanh cong.
              </div>
            )}
            {success.paymentMethod === 'zalopay' && (
              <div className="rounded-xl bg-blue-50 p-3 text-sm text-blue-800">
                Da xac nhan thanh toan ZaloPay thanh cong.
              </div>
            )}

            <p className="mt-3 text-xs text-gray-400">
              Don hang se duoc giao trong 2-4 ngay lam viec. Ban co the theo doi
              trong muc don hang.
            </p>
          </div>

          <div className="mt-6 flex gap-3">
            <Link
              to={`/client/orders/${success.orderId}`}
              className="flex-1 rounded-full border border-[#006241] py-3 text-sm font-bold text-[#006241] transition hover:bg-[#006241] hover:text-white"
            >
              Xem don hang
            </Link>
            <Link
              to="/client"
              className="flex-1 rounded-full py-3 text-sm font-bold text-white transition active:scale-95"
              style={{ background: '#00754A' }}
            >
              Ve trang chu
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {simulateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm overflow-hidden rounded-[2rem] bg-white shadow-2xl">
            <div
              className="px-6 py-5 text-center text-white"
              style={{ background: selectedMethodInfo?.color ?? '#1E3932' }}
            >
              <div className="flex items-center justify-between">
                <p className="text-lg font-black">
                  {selectedMethodInfo?.emoji} {selectedMethodInfo?.label}
                </p>
                <button
                  onClick={() => setSimulateOpen(false)}
                  className="rounded-xl p-1.5 transition hover:bg-white/20"
                >
                  <X size={18} />
                </button>
              </div>
              <p className="mt-1 text-sm text-white/70">Dang cho thanh toan...</p>
            </div>

            <div className="p-6 text-center">
              <div className="mx-auto mb-4 flex h-48 w-48 items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50">
                <div className="grid grid-cols-7 gap-0.5 p-2">
                  {Array.from({ length: 49 }).map((_, index) => {
                    const pattern = [
                      0, 1, 2, 8, 9, 11, 14, 16, 18, 22, 24, 25, 26, 28, 30,
                      32, 36, 38, 40, 42, 44, 45, 46, 47, 48,
                    ];
                    return (
                      <div
                        key={index}
                        className={`h-5 w-5 rounded-sm ${
                          pattern.includes(index)
                            ? 'bg-gray-800'
                            : 'bg-transparent'
                        }`}
                      />
                    );
                  })}
                </div>
              </div>

              <p className="text-sm text-gray-500">Quet ma QR de thanh toan</p>
              <p className="mt-1 text-xl font-black text-[#1E3932]">
                {formatPrice(total)}
              </p>

              <div className="mt-3 flex items-center justify-center gap-2 text-sm font-semibold text-orange-500">
                <Timer size={15} />
                <span>Het han sau {fmtCountdown}</span>
              </div>

              {simRef && (
                <p className="mt-2 text-[11px] text-gray-400">
                  Ma GD: {simRef.slice(-12).toUpperCase()}
                </p>
              )}

              <div className="mt-5 space-y-2">
                <button
                  onClick={() => void handleConfirmSimPayment()}
                  disabled={simConfirming}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-black text-white transition active:scale-95 disabled:opacity-60"
                  style={{ background: selectedMethodInfo?.color ?? '#006241' }}
                >
                  {simConfirming ? (
                    <LoaderCircle size={16} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={16} />
                  )}
                  Xac nhan da thanh toan (Demo)
                </button>
                <button
                  onClick={() => setSimulateOpen(false)}
                  className="w-full rounded-2xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-500 transition hover:bg-gray-50"
                >
                  Huy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ background: '#f2f0eb', minHeight: '80vh' }}>
        <div className="mx-auto max-w-5xl px-4 py-10 lg:px-6">
          <div className="mb-8 flex items-center justify-center gap-3 text-sm">
            {[
              { label: 'Gio hang', done: true },
              { label: 'Dia chi & Van chuyen', done: true },
              { label: 'Thanh toan', active: true },
              { label: 'Xac nhan' },
            ].map((step, index) => (
              <div key={step.label} className="flex items-center gap-2">
                {index > 0 && (
                  <ChevronRight size={14} className="text-gray-300" />
                )}
                <span
                  className={`text-sm font-semibold ${
                    step.done
                      ? 'text-[#006241]'
                      : step.active
                        ? 'font-black text-[#1E3932]'
                        : 'text-gray-400'
                  }`}
                >
                  {step.done ? '✓ ' : ''}
                  {step.label}
                </span>
              </div>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
            <div>
              <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-[#1E3932]">
                <CreditCard size={20} className="text-[#006241]" /> Phuong thuc
                thanh toan
              </h2>

              {loadingSettings ? (
                <div className="flex justify-center rounded-2xl bg-white py-12">
                  <LoaderCircle size={22} className="animate-spin text-[#006241]" />
                </div>
              ) : availableMethods.length === 0 ? (
                <div className="rounded-2xl bg-white p-5 text-sm text-gray-500">
                  Hien tai admin da tat tat ca phuong thuc thanh toan. Vui long
                  lien he cua hang de duoc ho tro.
                </div>
              ) : (
                <div className="space-y-3">
                  {availableMethods.map((paymentMethod) => (
                    <button
                      key={paymentMethod.id}
                      onClick={() => setMethod(paymentMethod.id)}
                      className={`flex w-full items-start gap-4 rounded-2xl border-2 p-4 text-left transition ${
                        method === paymentMethod.id
                          ? 'border-[#006241] bg-[#006241]/5'
                          : 'border-transparent bg-white hover:border-[#006241]/20'
                      }`}
                    >
                      <span className="mt-0.5 text-2xl">
                        {paymentMethod.emoji}
                      </span>
                      <div className="flex-1">
                        <p className="font-bold text-[#1E3932]">
                          {paymentMethod.label}
                        </p>
                        <p className="mt-0.5 text-xs text-gray-500">
                          {paymentSettings[paymentMethod.id]?.description ||
                            paymentMethod.desc}
                        </p>
                      </div>
                      <div
                        className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${
                          method === paymentMethod.id
                            ? 'border-[#006241] bg-[#006241]'
                            : 'border-gray-300'
                        }`}
                      >
                        {method === paymentMethod.id && (
                          <div className="h-2 w-2 rounded-full bg-white" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {(state.shippingAddress || state.deliveryName) && (
                <div className="mt-4 space-y-2 rounded-2xl bg-white p-4">
                  {state.shippingAddress && (
                    <div className="flex items-start gap-2">
                      <MapPin
                        size={15}
                        className="mt-0.5 shrink-0 text-[#006241]"
                      />
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                          Dia chi nhan hang
                        </p>
                        <p className="text-sm text-[#1E3932]">
                          {state.shippingAddress}
                        </p>
                      </div>
                    </div>
                  )}

                  {state.deliveryName && (
                    <div className="flex items-start gap-2">
                      <Truck
                        size={15}
                        className="mt-0.5 shrink-0 text-[#006241]"
                      />
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                          Phuong thuc van chuyen
                        </p>
                        <p className="text-sm text-[#1E3932]">
                          {state.deliveryName}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-4 flex items-start gap-3 rounded-2xl bg-[#d4e9e2] p-4 text-sm text-[#1E3932]">
                <ShieldCheck
                  size={18}
                  className="mt-0.5 shrink-0 text-[#006241]"
                />
                <p>
                  Thong tin thanh toan cua ban duoc bao mat. Chung toi khong luu
                  tru thong tin the.
                </p>
              </div>

              <div className="mt-4 flex gap-3">
                <Link
                  to="/client/checkout"
                  className="flex items-center gap-2 rounded-full border border-black/10 px-5 py-3 text-sm font-semibold text-gray-500 hover:text-[#006241]"
                >
                  <ArrowLeft size={15} /> Quay lai
                </Link>
                <button
                  onClick={() => void handlePlaceOrder()}
                  disabled={placing || loadingSettings || !availableMethods.length}
                  className="flex flex-1 items-center justify-center gap-2 rounded-full py-3 text-sm font-bold text-white disabled:opacity-60 active:scale-95"
                  style={{ background: '#00754A' }}
                >
                  {placing ? (
                    <LoaderCircle size={16} className="animate-spin" />
                  ) : null}
                  {placing
                    ? 'Dang xu ly...'
                    : `Dat hang · ${formatPrice(total)}`}
                </button>
              </div>
            </div>

            <div>
              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <p className="mb-4 text-sm font-black uppercase tracking-wider text-gray-400">
                  Xac nhan don hang
                </p>
                {cart && (
                  <div className="max-h-52 space-y-3 overflow-y-auto">
                    {cart.items.map((item) => (
                      <div key={item.id} className="flex items-start gap-3">
                        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-[#f2f0eb]">
                          {item.primaryImageUrl ? (
                            <img
                              src={item.primaryImageUrl}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center">
                              <Leaf
                                size={18}
                                className="text-[#006241]/30"
                              />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-xs font-semibold text-[#1E3932]">
                            {item.productName}
                          </p>
                          <p className="text-xs text-gray-400">
                            x{item.quantity}
                          </p>
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
                    <span className="text-gray-500">Tam tinh</span>
                    <span className="font-semibold">
                      {formatPrice(subtotal)}
                    </span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Giam gia</span>
                      <span className="font-semibold text-red-500">
                        -{formatPrice(discountAmount)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-500">Van chuyen</span>
                    <span
                      className={`font-semibold ${
                        shipping === 0 ? 'text-[#006241]' : ''
                      }`}
                    >
                      {shipping === 0 ? 'Mien phi' : formatPrice(shipping)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-black/5 pt-2 text-base font-black">
                    <span className="text-[#1E3932]">Tong cong</span>
                    <span className="text-[#006241]">
                      {formatPrice(total)}
                    </span>
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
