import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BadgePercent,
  Check,
  Copy,
  Leaf,
  LockKeyhole,
  ShoppingCart,
  Sparkles,
  TicketPercent,
} from 'lucide-react';
import { useCart } from '../../hooks/useCart';
import { useClientSession } from '../../hooks/useClientSession';
import {
  type Voucher,
  fetchVouchersForCart,
  getVoucherProgress,
  money,
  sortVouchers,
  voucherExpiryLabel,
  voucherMinOrder,
  voucherMissingAmount,
  voucherSavings,
  voucherValueLabel,
} from '../../lib/vouchers';

type VoucherFilter = 'all' | 'ready' | 'locked';

export default function Vouchers() {
  const navigate = useNavigate();
  const { session } = useClientSession();
  const { cart } = useCart();
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<VoucherFilter>('all');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const subtotal = Number(cart?.totalAmount ?? 0);
  const productIds = useMemo(
    () => cart?.items.map((item) => item.productId) ?? [],
    [cart],
  );
  const sortedVouchers = useMemo(() => sortVouchers(vouchers), [vouchers]);
  const readyCount = sortedVouchers.filter((voucher) => voucher.eligible).length;
  const bestVoucher = sortedVouchers.find(
    (voucher) => voucher.eligible && voucherSavings(voucher) > 0,
  );
  const visibleVouchers = sortedVouchers.filter((voucher) => {
    if (filter === 'ready') return voucher.eligible;
    if (filter === 'locked') return !voucher.eligible;
    return true;
  });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetchVouchersForCart({ orderValue: subtotal, productIds })
      .then((data) => {
        if (!cancelled) setVouchers(data);
      })
      .catch(() => {
        if (!cancelled) setVouchers([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [subtotal, productIds.join('|')]);

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      window.setTimeout(() => setCopiedCode(null), 1400);
    } catch {
      setCopiedCode(code);
      window.setTimeout(() => setCopiedCode(null), 1400);
    }
  }

  function applyVoucher(code: string) {
    void navigate(`/client/cart?voucher=${encodeURIComponent(code)}`);
  }

  return (
    <div style={{ background: '#f2f0eb', minHeight: '80vh' }}>
      <div className="mx-auto max-w-6xl px-4 py-10 lg:px-6">
        <section className="relative overflow-hidden rounded-[2.5rem] bg-[#173d2b] p-7 text-white shadow-[0_30px_80px_-45px_rgba(23,61,43,0.9)] md:p-10">
          <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#d6a51d]/35 blur-3xl" />
          <div className="absolute bottom-0 right-10 hidden h-36 w-36 rounded-[2rem] border border-white/10 bg-white/8 rotate-12 md:block" />
          <div className="relative max-w-3xl">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-white/80">
              <Sparkles size={14} /> Kho voucher
            </p>
            <h1 className="mt-5 text-4xl font-black tracking-tight md:text-6xl">
              Săn voucher trước khi đặt hàng
            </h1>
            <p className="mt-4 max-w-2xl text-sm font-medium leading-7 text-white/72">
              Hệ thống tự đối chiếu giỏ hàng, đơn tối thiểu, lượt đã dùng và
              voucher riêng của tài khoản để gợi ý mã có thể dùng ngay.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <MetricPill
                label="Giỏ hiện tại"
                value={subtotal > 0 ? money(subtotal) : 'Chưa có hàng'}
              />
              <MetricPill label="Dùng ngay" value={`${readyCount} voucher`} />
              <MetricPill
                label="Tốt nhất"
                value={
                  bestVoucher ? money(voucherSavings(bestVoucher)) : 'Đang chờ'
                }
              />
            </div>
          </div>
        </section>

        {!session ? (
          <div className="mt-6 rounded-[2rem] border border-[#d6a51d]/25 bg-[#fff7db] p-5 text-sm font-semibold text-[#7a5a00]">
            Đăng nhập để thấy voucher riêng và biết mã nào bạn đã dùng. Danh
            sách bên dưới chỉ gồm voucher công khai.
          </div>
        ) : null}

        <div className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {[
              { key: 'all', label: 'Tất cả' },
              { key: 'ready', label: 'Dùng ngay' },
              { key: 'locked', label: 'Cần mua thêm' },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key as VoucherFilter)}
                className={`shrink-0 rounded-full px-5 py-2.5 text-sm font-black transition ${
                  filter === item.key
                    ? 'bg-[#006241] text-white'
                    : 'bg-white text-[#1E3932] hover:bg-[#006241]/10'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <Link
            to="/client/cart"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-black text-[#006241] shadow-sm transition hover:bg-[#edf3ee]"
          >
            <ShoppingCart size={16} /> Về giỏ hàng
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#006241] border-t-transparent" />
          </div>
        ) : visibleVouchers.length ? (
          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {visibleVouchers.map((voucher) => (
              <div key={voucher.id}>
                <VoucherHuntCard
                  voucher={voucher}
                  subtotal={subtotal}
                  copied={copiedCode === voucher.code}
                  onCopy={() => void copyCode(voucher.code)}
                  onApply={() => applyVoucher(voucher.code)}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-6 flex flex-col items-center justify-center rounded-[2rem] bg-white py-20 text-center shadow-sm">
            <TicketPercent size={56} className="mb-4 text-[#006241]/20" />
            <h2 className="text-xl font-black text-[#1E3932]">
              Chưa có voucher phù hợp
            </h2>
            <p className="mt-2 max-w-md text-sm text-gray-500">
              Thử thêm sản phẩm vào giỏ hoặc quay lại sau khi cửa hàng mở thêm
              chương trình ưu đãi.
            </p>
            <Link
              to="/client/products"
              className="mt-6 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-white"
              style={{ background: '#00754A' }}
            >
              <Leaf size={16} /> Mua sắm ngay
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/55">
        {label}
      </p>
      <p className="mt-1 text-sm font-black text-white">{value}</p>
    </div>
  );
}

function VoucherHuntCard({
  voucher,
  subtotal,
  copied,
  onCopy,
  onApply,
}: {
  voucher: Voucher;
  subtotal: number;
  copied: boolean;
  onCopy: () => void;
  onApply: () => void;
}) {
  const eligible = Boolean(voucher.eligible);
  const missingAmount = voucherMissingAmount(voucher);
  const progress = getVoucherProgress(voucher, subtotal);

  return (
    <article className="group overflow-hidden rounded-[2rem] bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
      <div className="relative min-h-40 overflow-hidden bg-[#1E3932] p-5 text-white">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[#d6a51d]/40 blur-2xl transition group-hover:scale-125" />
        <div className="relative flex items-start justify-between">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/12">
            <BadgePercent size={28} />
          </div>
          <span className="rounded-full bg-[#d6a51d] px-3 py-1 text-sm font-black text-[#1E3932]">
            {voucherValueLabel(voucher)}
          </span>
        </div>
        <div className="relative mt-5">
          <p className="text-2xl font-black tracking-tight">{voucher.code}</p>
          <p className="mt-1 line-clamp-2 text-sm font-medium text-white/70">
            {voucher.name}
          </p>
        </div>
      </div>

      <div className="p-5">
        <p className="line-clamp-2 min-h-10 text-sm leading-5 text-gray-500">
          {voucher.description ||
            `Áp dụng cho đơn từ ${money(voucherMinOrder(voucher))}.`}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <InfoBox
            label="Giảm dự kiến"
            value={eligible ? money(voucherSavings(voucher)) : 'Chưa đủ'}
          />
          <InfoBox label="Hạn dùng" value={voucherExpiryLabel(voucher.expiresAt)} />
        </div>

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between text-xs font-bold">
            <span className="text-gray-500">
              Đơn tối thiểu {money(voucherMinOrder(voucher))}
            </span>
            <span className={eligible ? 'text-[#006241]' : 'text-[#a56b00]'}>
              {eligible ? 'Đủ điều kiện' : `Thiếu ${money(missingAmount)}`}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[#f2f0eb]">
            <div
              className={`h-full rounded-full ${
                eligible ? 'bg-[#006241]' : 'bg-[#d6a51d]'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {voucher.isPrivate ? (
          <div className="mt-4 flex items-center gap-2 rounded-2xl bg-[#edf3ee] px-4 py-3 text-xs font-bold text-[#006241]">
            <LockKeyhole size={14} /> Voucher riêng cho tài khoản của bạn
          </div>
        ) : null}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCopy}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-black/10 text-[#1E3932] transition hover:border-[#006241]/30 hover:text-[#006241]"
            title="Sao chép mã"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
          <button
            type="button"
            onClick={onApply}
            disabled={!eligible}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[#006241] px-4 py-3 text-sm font-black text-white transition hover:bg-[#00533a] disabled:bg-gray-200 disabled:text-gray-500"
          >
            {eligible ? 'Áp dụng vào giỏ' : 'Chưa đủ điều kiện'}
            {eligible ? <ArrowRight size={15} /> : null}
          </button>
        </div>
      </div>
    </article>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[#f7f5ef] px-4 py-3">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-black text-[#1E3932]">{value}</p>
    </div>
  );
}
