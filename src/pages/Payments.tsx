import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search, CreditCard, LoaderCircle, ChevronLeft, ChevronRight, Settings, ToggleLeft, ToggleRight, Save, CheckCircle2, BarChart3 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { apiClient } from '../lib/api';
import { useLanguage } from '../i18n/language-context';
import { useToast } from '../hooks/useToast';

type TxStatus = 'pending' | 'success' | 'failed';
type TxItem = {
  id: string;
  orderId: string;
  provider: string;
  transactionRef: string;
  transactionStatus: TxStatus;
  paymentStatus: string;
  amount: string;
  gatewayCode: string | null;
  gatewayMessage: string | null;
  createdAt: string;
  user: { username: string; email: string } | null;
};

type TxResponse = {
  meta: { page: number; limit: number; total: number; totalPages: number };
  items: TxItem[];
};

type MethodConfig = {
  isActive: boolean;
  description: string;
  bankName?: string;
  accountNumber?: string;
  accountHolder?: string;
};

type PaymentMethodsConfig = Record<string, MethodConfig>;

const PAYMENT_METHODS = [
  {
    key: 'cod',
    label: 'COD (Thanh toán khi nhận hàng)',
    description: 'Khách hàng thanh toán trực tiếp khi nhận hàng.',
    color: '#6b7280',
    icon: '💵',
    hasBank: false,
  },
  {
    key: 'bank_transfer',
    label: 'Chuyển khoản ngân hàng',
    description: 'Chuyển khoản qua tài khoản ngân hàng của cửa hàng.',
    color: '#0065AC',
    icon: '🏦',
    hasBank: true,
  },
  {
    key: 'momo',
    label: 'MoMo',
    description: 'Thanh toán qua ví điện tử MoMo.',
    color: '#AE2070',
    icon: '💜',
    hasBank: false,
  },
  {
    key: 'vnpay',
    label: 'VNPay',
    description: 'Thanh toán qua cổng thanh toán VNPay.',
    color: '#005BAA',
    icon: '🔵',
    hasBank: false,
  },
  {
    key: 'zalopay',
    label: 'ZaloPay',
    description: 'Thanh toán qua ví ZaloPay.',
    color: '#0068FF',
    icon: '⚡',
    hasBank: false,
  },
];

const PROVIDER_LABELS: Record<string, { label: string; color: string }> = {
  cod: { label: 'COD', color: '#6b7280' },
  bank_transfer: { label: 'Chuyển khoản', color: '#0065AC' },
  momo: { label: 'MoMo', color: '#AE2070' },
  vnpay: { label: 'VNPay', color: '#005BAA' },
  zalopay: { label: 'ZaloPay', color: '#0068FF' },
  paypal: { label: 'PayPal', color: '#003087' },
};

const STATUS_CFG: Record<TxStatus, { label: string; cls: string }> = {
  pending: { label: 'Chờ xử lý', cls: 'bg-amber-100 text-amber-700' },
  success: { label: 'Thành công', cls: 'bg-emerald-100 text-emerald-700' },
  failed: { label: 'Thất bại', cls: 'bg-red-100 text-red-700' },
};

const CONFIG_KEY = 'payment_methods_config';

function loadConfig(): PaymentMethodsConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (raw) return JSON.parse(raw) as PaymentMethodsConfig;
  } catch {}
  const defaults: PaymentMethodsConfig = {};
  PAYMENT_METHODS.forEach((m) => {
    defaults[m.key] = { isActive: m.key === 'cod', description: m.description };
  });
  return defaults;
}

function formatVND(amount: string | number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(amount));
}

export default function Payments() {
  const { language } = useLanguage();
  const isVi = language === 'vi';
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'config' | 'transactions'>('config');

  // ── Method config state ────────────────────────────────────────────────────
  const [config, setConfig] = useState<PaymentMethodsConfig>(loadConfig);
  const [savedKey, setSavedKey] = useState<string | null>(null);

  const handleToggle = (key: string) => {
    setConfig((c) => ({ ...c, [key]: { ...c[key], isActive: !c[key]?.isActive } }));
  };

  const handleDescChange = (key: string, value: string) => {
    setConfig((c) => ({ ...c, [key]: { ...c[key], description: value } }));
  };

  const handleBankChange = (key: string, field: 'bankName' | 'accountNumber' | 'accountHolder', value: string) => {
    setConfig((c) => ({ ...c, [key]: { ...c[key], [field]: value } }));
  };

  const handleSave = (key: string) => {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    setSavedKey(key);
    setTimeout(() => setSavedKey(null), 2000);
    showToast({ tone: 'success', title: 'Đã lưu cấu hình' });
  };

  const handleSaveAll = () => {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    showToast({ tone: 'success', title: 'Đã lưu tất cả cấu hình thanh toán' });
  };

  // ── Transactions state ─────────────────────────────────────────────────────
  const [items, setItems] = useState<TxItem[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [filterProvider, setFilterProvider] = useState(searchParams.get('provider') ?? '');
  const [filterStatus, setFilterStatus] = useState(searchParams.get('status') ?? '');
  const [page, setPage] = useState(Number(searchParams.get('page') ?? '1'));

  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(isVi ? 'vi-VN' : 'en-US', { dateStyle: 'short', timeStyle: 'short' }),
    [isVi],
  );

  useEffect(() => {
    if (activeTab !== 'transactions') return;
    const next = new URLSearchParams();
    if (filterProvider) next.set('provider', filterProvider);
    if (filterStatus) next.set('status', filterStatus);
    if (page > 1) next.set('page', String(page));
    setSearchParams(next, { replace: true });
  }, [filterProvider, filterStatus, page, setSearchParams, activeTab]);

  useEffect(() => { setPage(1); }, [filterProvider, filterStatus]);

  useEffect(() => {
    if (activeTab !== 'transactions') return;
    let cancelled = false;
    setLoading(true);
    const q = new URLSearchParams({ page: String(page), limit: '20' });
    if (filterProvider) q.set('provider', filterProvider);
    if (filterStatus) q.set('status', filterStatus);
    void apiClient
      .get<TxResponse>(`/payments/admin/transactions?${q.toString()}`)
      .then((data) => {
        if (!cancelled) { setItems(data.items ?? []); setMeta(data.meta); }
      })
      .catch((err: unknown) => {
        if (!cancelled) showToast({ tone: 'error', title: 'Không tải được giao dịch', description: err instanceof Error ? err.message : '' });
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [filterProvider, filterStatus, page, reloadKey, showToast, activeTab]);

  const filteredItems = search.trim()
    ? items.filter((i) =>
        i.transactionRef.toLowerCase().includes(search.toLowerCase()) ||
        i.orderId.toLowerCase().includes(search.toLowerCase()) ||
        i.user?.username?.toLowerCase().includes(search.toLowerCase()) ||
        i.user?.email?.toLowerCase().includes(search.toLowerCase()),
      )
    : items;

  const totalSuccess = items.filter((i) => i.transactionStatus === 'success').length;
  const totalFailed = items.filter((i) => i.transactionStatus === 'failed').length;
  const totalRevenue = items.filter((i) => i.transactionStatus === 'success').reduce((s, i) => s + Number(i.amount), 0);

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-primary">
            {isVi ? 'Quản lý thanh toán' : 'Payment Management'}
          </h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            {isVi ? 'Cấu hình phương thức và theo dõi giao dịch thanh toán.' : 'Configure payment methods and track transactions.'}
          </p>
        </div>
        {activeTab === 'config' && (
          <button
            type="button"
            onClick={handleSaveAll}
            className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-primary/90"
          >
            <Save size={15} /> Lưu tất cả
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-2xl border border-on-surface/8 bg-surface p-1 w-fit">
        {([
          { id: 'config', label: isVi ? 'Phương thức thanh toán' : 'Payment methods', icon: Settings },
          { id: 'transactions', label: isVi ? 'Lịch sử giao dịch' : 'Transactions', icon: BarChart3 },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
              activeTab === id
                ? 'bg-primary text-white shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Config tab ─────────────────────────────────────────────────────── */}
      {activeTab === 'config' && (
        <div className="space-y-4">
          {PAYMENT_METHODS.map((method) => {
            const cfg = config[method.key] ?? { isActive: false, description: method.description };
            const isSaved = savedKey === method.key;
            return (
              <section
                key={method.key}
                className={`overflow-hidden rounded-[2rem] border bg-white shadow-sm transition ${
                  cfg.isActive ? 'border-on-surface/12' : 'border-on-surface/6 opacity-70'
                }`}
              >
                {/* Header */}
                <div className="flex items-center gap-4 border-b border-on-surface/8 px-6 py-4">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-xl"
                    style={{ background: `${method.color}18` }}
                  >
                    {method.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-on-surface">{method.label}</p>
                    <p className="text-xs text-on-surface-variant">
                      {cfg.isActive ? (isVi ? '✓ Đang hoạt động' : '✓ Active') : (isVi ? 'Tắt' : 'Inactive')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggle(method.key)}
                    className="shrink-0 transition"
                    title={cfg.isActive ? 'Tắt' : 'Bật'}
                  >
                    {cfg.isActive
                      ? <ToggleRight size={36} style={{ color: method.color }} />
                      : <ToggleLeft size={36} className="text-on-surface-variant/30" />
                    }
                  </button>
                </div>

                {/* Body */}
                <div className="grid gap-4 p-6 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant/60">
                      {isVi ? 'Mô tả (hiển thị cho khách hàng)' : 'Description (shown to customers)'}
                    </label>
                    <textarea
                      value={cfg.description}
                      onChange={(e) => handleDescChange(method.key, e.target.value)}
                      rows={3}
                      className="w-full resize-none rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none focus:border-primary/40"
                    />
                  </div>

                  {method.hasBank && (
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant/60">
                          {isVi ? 'Tên ngân hàng' : 'Bank name'}
                        </label>
                        <input
                          value={cfg.bankName ?? ''}
                          onChange={(e) => handleBankChange(method.key, 'bankName', e.target.value)}
                          placeholder="VD: Vietcombank"
                          className="w-full rounded-2xl border border-on-surface/10 bg-surface px-4 py-2.5 text-sm outline-none focus:border-primary/40"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant/60">
                            {isVi ? 'Số tài khoản' : 'Account no.'}
                          </label>
                          <input
                            value={cfg.accountNumber ?? ''}
                            onChange={(e) => handleBankChange(method.key, 'accountNumber', e.target.value)}
                            placeholder="0123456789"
                            className="w-full rounded-2xl border border-on-surface/10 bg-surface px-4 py-2.5 text-sm outline-none focus:border-primary/40"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant/60">
                            {isVi ? 'Tên chủ TK' : 'Account holder'}
                          </label>
                          <input
                            value={cfg.accountHolder ?? ''}
                            onChange={(e) => handleBankChange(method.key, 'accountHolder', e.target.value)}
                            placeholder="NGUYEN VAN A"
                            className="w-full rounded-2xl border border-on-surface/10 bg-surface px-4 py-2.5 text-sm outline-none focus:border-primary/40"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="flex justify-end border-t border-on-surface/6 px-6 py-3">
                  <button
                    type="button"
                    onClick={() => handleSave(method.key)}
                    className="inline-flex items-center gap-2 rounded-xl border border-on-surface/10 px-4 py-2 text-sm font-semibold text-on-surface-variant transition hover:border-primary/40 hover:text-primary"
                  >
                    {isSaved
                      ? <><CheckCircle2 size={14} className="text-emerald-500" /> Đã lưu</>
                      : <><Save size={14} /> Lưu</>
                    }
                  </button>
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* ── Transactions tab ───────────────────────────────────────────────── */}
      {activeTab === 'transactions' && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Tổng GD', value: meta.total, color: 'text-primary' },
              { label: 'Thành công', value: totalSuccess, color: 'text-emerald-600' },
              { label: 'Thất bại', value: totalFailed, color: 'text-red-500' },
              { label: 'Doanh thu (trang này)', value: formatVND(totalRevenue), color: 'text-primary' },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-on-surface/8 bg-white p-4 text-center shadow-sm">
                <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                <p className="mt-1 text-xs text-on-surface-variant">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Filter bar */}
          <section className="rounded-[2rem] border border-on-surface/8 bg-white p-5 shadow-sm">
            <div className="grid gap-3 sm:grid-cols-[1fr_180px_160px_auto]">
              <label className="relative">
                <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Tìm mã GD, đơn hàng, người dùng..."
                  className="w-full rounded-2xl border border-on-surface/10 bg-surface py-3 pl-11 pr-4 text-sm outline-none focus:border-primary/40"
                />
              </label>
              <select
                value={filterProvider}
                onChange={(e) => setFilterProvider(e.target.value)}
                className="rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none"
              >
                <option value="">Tất cả phương thức</option>
                {Object.entries(PROVIDER_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none"
              >
                <option value="">Tất cả trạng thái</option>
                <option value="pending">Chờ xử lý</option>
                <option value="success">Thành công</option>
                <option value="failed">Thất bại</option>
              </select>
              <button
                type="button"
                onClick={() => setReloadKey((k) => k + 1)}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm font-semibold text-on-surface-variant transition hover:border-primary/30 hover:text-primary disabled:opacity-50"
              >
                <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                Làm mới
              </button>
            </div>
          </section>

          {/* Table */}
          <section className="overflow-hidden rounded-[2rem] border border-on-surface/8 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead className="border-b border-on-surface/8 bg-surface/70 text-[11px] font-black uppercase tracking-[0.18em] text-on-surface-variant/60">
                  <tr>
                    <th className="px-4 py-4">Mã giao dịch</th>
                    <th className="px-4 py-4">Đơn hàng</th>
                    <th className="px-4 py-4">Người dùng</th>
                    <th className="px-4 py-4">Phương thức</th>
                    <th className="px-4 py-4">Số tiền</th>
                    <th className="px-4 py-4 text-center">Trạng thái</th>
                    <th className="px-4 py-4">Ngày</th>
                    <th className="px-4 py-4">Mã GW</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-on-surface/6 text-sm">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-16 text-center text-on-surface-variant">
                        <span className="inline-flex items-center gap-2">
                          <LoaderCircle size={16} className="animate-spin" /> Đang tải...
                        </span>
                      </td>
                    </tr>
                  ) : filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-16 text-center text-on-surface-variant">
                        <CreditCard size={28} className="mx-auto mb-3 text-primary/30" />
                        Không có giao dịch
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((tx) => {
                      const providerInfo = PROVIDER_LABELS[tx.provider] ?? { label: tx.provider, color: '#6b7280' };
                      const statusInfo = STATUS_CFG[tx.transactionStatus] ?? { label: tx.transactionStatus, cls: 'bg-gray-100 text-gray-700' };
                      return (
                        <tr key={tx.id} className="hover:bg-surface/40">
                          <td className="px-4 py-3 font-mono text-xs text-on-surface-variant">
                            {tx.transactionRef.slice(-12).toUpperCase()}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs">
                            <span className="cursor-pointer text-primary hover:underline">
                              {tx.orderId.slice(-8).toUpperCase()}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-on-surface-variant">
                            {tx.user ? (
                              <div>
                                <p className="font-semibold text-on-surface">{tx.user.username}</p>
                                <p className="text-[11px] text-on-surface-variant/60">{tx.user.email}</p>
                              </div>
                            ) : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black text-white"
                              style={{ background: providerInfo.color }}
                            >
                              {providerInfo.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-bold text-on-surface">{formatVND(tx.amount)}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${statusInfo.cls}`}>
                              {statusInfo.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-xs text-on-surface-variant">
                            {dateFormatter.format(new Date(tx.createdAt))}
                          </td>
                          <td className="px-4 py-3 text-xs text-on-surface-variant">{tx.gatewayCode ?? '—'}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {meta.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-on-surface/8 px-5 py-4">
                <p className="text-xs text-on-surface-variant">
                  Trang {meta.page}/{meta.totalPages} · {meta.total} giao dịch
                </p>
                <div className="flex gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-on-surface/10 text-on-surface-variant transition hover:border-primary/30 hover:text-primary disabled:opacity-40"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    disabled={page >= meta.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-on-surface/10 text-on-surface-variant transition hover:border-primary/30 hover:text-primary disabled:opacity-40"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
