import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  BadgePercent,
  CheckCircle2,
  Leaf,
  Minus,
  PackageCheck,
  Plus,
  ShoppingCart,
  Sparkles,
  Tag,
  TicketPercent,
  Trash2,
} from 'lucide-react';
import { useCart } from '../../hooks/useCart';
import { useClientSession } from '../../hooks/useClientSession';
import {
  type DiscountResult,
  type Voucher,
  fetchVouchersForCart,
  getVoucherProgress,
  money,
  sortVouchers,
  validateVoucherCode,
  voucherExpiryLabel,
  voucherMissingAmount,
  voucherSavings,
  voucherValueLabel,
} from '../../lib/vouchers';

function formatPrice(price: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(price);
}

export default function Cart() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { session } = useClientSession();
  const { cart, loading, updateItem, removeItem } = useCart();

  const [discountCode, setDiscountCode] = useState('');
  const [discountResult, setDiscountResult] = useState<DiscountResult | null>(null);
  const [discountError, setDiscountError] = useState('');
  const [validatingCode, setValidatingCode] = useState(false);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loadingVouchers, setLoadingVouchers] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const subtotal = Number(cart?.totalAmount ?? 0);
  const productIds = useMemo(
    () => cart?.items.map((item) => item.productId) ?? [],
    [cart],
  );
  const productIdsKey = productIds.join('|');
  const discountAmount = discountResult
    ? Number(discountResult.discountAmount)
    : 0;
  const shipping = subtotal >= 500000 ? 0 : 30000;
  const total = Math.max(0, subtotal - discountAmount) + shipping;

  const sortedVouchers = useMemo(() => sortVouchers(vouchers), [vouchers]);
  const bestVoucher = sortedVouchers.find(
    (voucher) => voucher.eligible && voucherSavings(voucher) > 0,
  );
  const displayedVouchers = sortedVouchers.slice(0, 4);

  const loadVouchers = useCallback(async () => {
    if (!cart || cart.items.length === 0) {
      setVouchers([]);
      return;
    }

    setLoadingVouchers(true);
    try {
      const data = await fetchVouchersForCart({
        orderValue: subtotal,
        productIds,
      });
      setVouchers(data);
    } catch {
      setVouchers([]);
    } finally {
      setLoadingVouchers(false);
    }
  }, [cart, subtotal, productIdsKey]);

  useEffect(() => {
    void loadVouchers();
  }, [loadVouchers]);

  const validateAndApply = useCallback(
    async (code: string) => {
      const normalized = code.trim().toUpperCase();
      if (!normalized || !cart) return;

      setDiscountCode(normalized);
      setDiscountError('');
      setValidatingCode(true);
      try {
        const result = await validateVoucherCode(normalized, {
          orderValue: subtotal,
          productIds,
        });
        setDiscountResult(result);
      } catch (error) {
        setDiscountResult(null);
        setDiscountError(
          error instanceof Error
            ? error.message
            : 'Voucher không hợp lệ hoặc đã hết hạn',
        );
      } finally {
        setValidatingCode(false);
      }
    },
    [cart, subtotal, productIdsKey],
  );

  useEffect(() => {
    const voucherFromUrl = searchParams.get('voucher');
    if (!voucherFromUrl || !cart?.items.length || discountResult) return;

    void validateAndApply(voucherFromUrl).finally(() => {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('voucher');
      setSearchParams(nextParams, { replace: true });
    });
  }, [cart, discountResult, searchParams, setSearchParams, validateAndApply]);

  const clearDiscount = () => {
    setDiscountResult(null);
    setDiscountCode('');
    setDiscountError('');
  };

  const handleRemove = async (itemId: string) => {
    setRemovingId(itemId);
    try {
      await removeItem(itemId);
      clearDiscount();
    } finally {
      setRemovingId(null);
    }
  };

  const handleQuantityChange = async (itemId: string, quantity: number) => {
    await updateItem(itemId, quantity);
    clearDiscount();
  };

  const handleCheckout = () => {
    if (!cart || cart.totalItems === 0) return;
    void navigate('/client/checkout', {
      state: {
        discountCode: discountResult?.code,
        discountAmount,
      },
    });
  };

  if (!session) {
    return (
      <div
        style={{ background: '#f2f0eb', minHeight: '60vh' }}
        className="flex items-center justify-center"
      >
        <div className="text-center">
          <ShoppingCart size={48} className="mx-auto mb-4 text-[#006241]/30" />
          <h2 className="text-xl font-black text-[#1E3932]">
            Bạn chưa đăng nhập
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            Vui lòng đăng nhập để xem giỏ hàng và voucher dành cho bạn.
          </p>
          <Link
            to="/client/login"
            className="mt-5 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-white"
            style={{ background: '#00754A' }}
          >
            Đăng nhập
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: '#f2f0eb', minHeight: '80vh' }}>
      <div className="mx-auto max-w-6xl px-4 py-10 lg:px-6">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p
              className="text-xs font-bold uppercase tracking-[0.25em]"
              style={{ color: '#006241' }}
            >
              Mua sắm
            </p>
            <h1 className="mt-1 text-3xl font-black text-[#1E3932]">
              Giỏ hàng
            </h1>
          </div>
          <Link
            to="/client/vouchers"
            className="inline-flex items-center gap-2 rounded-full border border-[#006241]/20 bg-white px-5 py-2.5 text-sm font-black text-[#006241] shadow-sm transition hover:border-[#006241]/40 hover:bg-[#edf3ee]"
          >
            <TicketPercent size={16} /> Săn voucher
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#006241] border-t-transparent" />
          </div>
        ) : !cart || cart.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-[2rem] bg-white py-20 text-center shadow-sm">
            <ShoppingCart size={56} className="mb-4 text-[#006241]/20" />
            <h2 className="text-xl font-black text-[#1E3932]">
              Giỏ hàng trống
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              Hãy khám phá sản phẩm và chọn voucher tốt trước khi đặt hàng.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                to="/client/products"
                className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-white"
                style={{ background: '#00754A' }}
              >
                <Leaf size={16} /> Khám phá sản phẩm
              </Link>
              <Link
                to="/client/vouchers"
                className="inline-flex items-center gap-2 rounded-full border border-[#006241]/20 px-6 py-3 text-sm font-bold text-[#006241]"
              >
                <TicketPercent size={16} /> Xem voucher
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_390px]">
            <div className="space-y-3">
              {cart.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-4 rounded-[1.5rem] bg-white p-4 shadow-sm"
                >
                  <Link
                    to={`/client/products/${item.productId}`}
                    className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-[#f2f0eb]"
                  >
                    {item.primaryImageUrl ? (
                      <img
                        src={item.primaryImageUrl}
                        alt={item.productName ?? ''}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Leaf size={24} className="text-[#006241]/20" />
                      </div>
                    )}
                  </Link>

                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/client/products/${item.productId}`}
                      className="line-clamp-2 text-sm font-bold text-[#1E3932] hover:text-[#006241]"
                    >
                      {item.productName}
                    </Link>
                    <p className="mt-1 text-xs text-gray-400">
                      Đơn giá: {formatPrice(Number(item.unitPrice))}
                    </p>

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            void handleQuantityChange(item.id, item.quantity - 1)
                          }
                          disabled={item.quantity <= 1}
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-black/10 transition hover:border-[#006241] disabled:opacity-40"
                        >
                          <Minus size={13} />
                        </button>
                        <span className="w-8 text-center text-sm font-bold text-[#1E3932]">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() =>
                            void handleQuantityChange(item.id, item.quantity + 1)
                          }
                          disabled={
                            item.availableQuantity != null &&
                            item.quantity >= item.availableQuantity
                          }
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-black/10 transition hover:border-[#006241] disabled:opacity-40"
                        >
                          <Plus size={13} />
                        </button>
                        {item.availableQuantity != null &&
                          item.quantity >= item.availableQuantity && (
                            <span className="text-[10px] font-semibold text-orange-500">
                              Tối đa
                            </span>
                          )}
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="font-black text-[#006241]">
                          {formatPrice(Number(item.lineTotal))}
                        </span>
                        <button
                          onClick={() => void handleRemove(item.id)}
                          disabled={removingId === item.id}
                          className="flex h-8 w-8 items-center justify-center rounded-full text-gray-300 transition hover:bg-red-50 hover:text-red-400 disabled:opacity-40"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <Link
                to="/client/products"
                className="flex items-center gap-2 rounded-[1.5rem] border-2 border-dashed border-[#006241]/20 bg-white px-5 py-4 text-sm font-semibold text-[#006241] transition hover:border-[#006241]/40"
              >
                <Leaf size={16} /> Tiếp tục mua sắm
              </Link>
            </div>

            <div className="space-y-4">
              <div className="overflow-hidden rounded-[2rem] bg-[#173d2b] text-white shadow-[0_24px_60px_rgba(23,61,43,0.22)]">
                <div className="relative p-5">
                  <div className="absolute right-4 top-4 h-24 w-24 rounded-full bg-[#d6a51d]/30 blur-2xl" />
                  <p className="relative flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-white/70">
                    <Sparkles size={14} /> Voucher tốt nhất
                  </p>
                  <h2 className="relative mt-2 text-2xl font-black">
                    {bestVoucher
                      ? `Tiết kiệm ${money(voucherSavings(bestVoucher))}`
                      : 'Săn thêm ưu đãi'}
                  </h2>
                  <p className="relative mt-2 text-sm font-medium text-white/70">
                    {bestVoucher
                      ? `${bestVoucher.code} đang phù hợp nhất với giỏ hàng này.`
                      : 'Chọn voucher đủ điều kiện hoặc mua thêm để mở khóa ưu đãi.'}
                  </p>
                </div>
              </div>

              <div className="rounded-[2rem] bg-white p-5 shadow-sm">
                <p className="mb-3 flex items-center gap-2 text-sm font-black text-[#1E3932]">
                  <Tag size={15} /> Mã giảm giá
                </p>

                {discountResult ? (
                  <div className="rounded-2xl border border-[#006241]/15 bg-[#edf7ef] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="flex items-center gap-2 text-sm font-black text-[#006241]">
                          <CheckCircle2 size={16} /> {discountResult.code}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-[#1E3932]/80">
                          {discountResult.name} · Giảm{' '}
                          {formatPrice(discountAmount)}
                        </p>
                      </div>
                      <button
                        onClick={clearDiscount}
                        className="text-xs font-bold text-gray-400 hover:text-red-500"
                      >
                        Xóa
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-2">
                      <input
                        value={discountCode}
                        onChange={(event) =>
                          setDiscountCode(event.target.value.toUpperCase())
                        }
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            void validateAndApply(discountCode);
                          }
                        }}
                        placeholder="Nhập mã hoặc chọn voucher bên dưới"
                        className="min-w-0 flex-1 rounded-full border border-black/10 bg-[#f2f0eb] px-4 py-2.5 text-sm outline-none focus:border-[#006241]"
                      />
                      <button
                        onClick={() => void validateAndApply(discountCode)}
                        disabled={validatingCode || !discountCode.trim()}
                        className="rounded-full px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
                        style={{ background: '#006241' }}
                      >
                        {validatingCode ? '...' : 'Áp dụng'}
                      </button>
                    </div>
                    {discountError && (
                      <p className="mt-2 text-xs font-semibold text-red-500">
                        {discountError}
                      </p>
                    )}
                  </>
                )}

                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-gray-400">
                      Voucher khả dụng
                    </p>
                    <Link
                      to="/client/vouchers"
                      className="text-xs font-bold text-[#006241] hover:underline"
                    >
                      Xem tất cả
                    </Link>
                  </div>
                  {loadingVouchers ? (
                    <div className="rounded-2xl bg-[#f2f0eb] px-4 py-5 text-center text-xs font-semibold text-gray-400">
                      Đang tìm voucher phù hợp...
                    </div>
                  ) : displayedVouchers.length ? (
                    displayedVouchers.map((voucher) => (
                      <div key={voucher.id}>
                        <VoucherMiniCard
                          voucher={voucher}
                          subtotal={subtotal}
                          selected={discountResult?.code === voucher.code}
                          onApply={() => void validateAndApply(voucher.code)}
                        />
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl bg-[#f2f0eb] px-4 py-5 text-center text-xs font-semibold text-gray-400">
                      Chưa có voucher phù hợp với giỏ hàng này.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-[2rem] bg-white p-5 shadow-sm">
                <p className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-wider text-gray-400">
                  <PackageCheck size={15} /> Tóm tắt đơn hàng
                </p>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">
                      Tạm tính ({cart.totalItems} sản phẩm)
                    </span>
                    <span className="font-semibold text-[#1E3932]">
                      {formatPrice(subtotal)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Phí vận chuyển</span>
                    <span
                      className={`font-semibold ${
                        shipping === 0 ? 'text-[#006241]' : ''
                      }`}
                    >
                      {shipping === 0 ? 'Miễn phí' : formatPrice(shipping)}
                    </span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Giảm giá</span>
                      <span className="font-semibold text-red-500">
                        -{formatPrice(discountAmount)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-black/5 pt-3 text-base">
                    <span className="font-black text-[#1E3932]">Tổng cộng</span>
                    <span className="font-black text-[#006241]">
                      {formatPrice(total)}
                    </span>
                  </div>
                </div>
                <button
                  onClick={handleCheckout}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-bold text-white transition hover:opacity-90 active:scale-95"
                  style={{ background: '#00754A' }}
                >
                  Tiến hành đặt hàng <ArrowRight size={16} />
                </button>
                <p className="mt-3 text-center text-[11px] text-gray-400">
                  Thanh toán bảo mật · Đổi trả 7 ngày
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function VoucherMiniCard({
  voucher,
  subtotal,
  selected,
  onApply,
}: {
  voucher: Voucher;
  subtotal: number;
  selected: boolean;
  onApply: () => void;
}) {
  const eligible = Boolean(voucher.eligible);
  const progress = getVoucherProgress(voucher, subtotal);
  const missingAmount = voucherMissingAmount(voucher);

  return (
    <div
      className={`overflow-hidden rounded-2xl border ${
        selected
          ? 'border-[#006241] bg-[#edf7ef]'
          : eligible
            ? 'border-[#006241]/15 bg-white'
            : 'border-black/6 bg-[#fbfaf7]'
      }`}
    >
      <div className="flex gap-3 p-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#006241] text-white">
          <BadgePercent size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-black text-[#1E3932]">{voucher.code}</p>
              <p className="line-clamp-1 text-xs font-semibold text-gray-500">
                {voucher.name}
              </p>
            </div>
            <span className="rounded-full bg-[#d6a51d]/18 px-2 py-1 text-xs font-black text-[#8a6400]">
              {voucherValueLabel(voucher)}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/5">
            <div
              className="h-full rounded-full bg-[#006241]"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold text-gray-500">
              {eligible
                ? `Giảm ${money(voucherSavings(voucher))}`
                : `Mua thêm ${money(missingAmount)}`}
            </p>
            <button
              type="button"
              onClick={onApply}
              disabled={!eligible || selected}
              className="rounded-full bg-[#006241] px-3 py-1.5 text-[11px] font-black text-white disabled:bg-gray-200 disabled:text-gray-500"
            >
              {selected ? 'Đã chọn' : eligible ? 'Áp dụng' : 'Chưa đủ'}
            </button>
          </div>
          <p className="mt-1 text-[10px] font-semibold text-gray-400">
            Hạn: {voucherExpiryLabel(voucher.expiresAt)}
          </p>
        </div>
      </div>
    </div>
  );
}
