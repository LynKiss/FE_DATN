import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  LoaderCircle,
  Mail,
  RefreshCw,
  Save,
  Search,
  Settings,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useToast } from '../hooks/useToast';
import {
  AdminCommerceSettings,
  DEFAULT_PAYMENT_SETTINGS,
  DEFAULT_SMTP_CONFIG,
  PaymentMethodConfig,
  PaymentMethodKey,
  PaymentSettings,
  SmtpConfig,
} from '../lib/commerce-settings';
import { apiClient } from '../lib/api';
import { useLanguage } from '../i18n/language-context';

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

type PaymentTab = 'config' | 'transactions' | 'smtp';

type MethodFieldKey = Exclude<
  keyof PaymentMethodConfig,
  'isActive' | 'description'
>;

type MethodField = {
  key: MethodFieldKey;
  label: string;
  placeholder: string;
  type?: 'text' | 'password';
};

const PAYMENT_METHODS: Array<{
  key: PaymentMethodKey;
  label: string;
  description: string;
  color: string;
  icon: string;
  fields?: MethodField[];
}> = [
  {
    key: 'cod',
    label: 'COD (Thanh toan khi nhan hang)',
    description: 'Khach hang thanh toan truc tiep khi nhan hang.',
    color: '#6b7280',
    icon: '💵',
  },
  {
    key: 'bank_transfer',
    label: 'Chuyen khoan ngan hang',
    description: 'Chuyen khoan qua tai khoan ngan hang cua cua hang.',
    color: '#0065AC',
    icon: '🏦',
    fields: [
      {
        key: 'bankName',
        label: 'Ten ngan hang',
        placeholder: 'VD: Vietcombank',
      },
      {
        key: 'accountNumber',
        label: 'So tai khoan',
        placeholder: '0123456789',
      },
      {
        key: 'accountHolder',
        label: 'Chu tai khoan',
        placeholder: 'CONG TY ABC',
      },
    ],
  },
  {
    key: 'momo',
    label: 'MoMo',
    description: 'Thanh toan qua vi dien tu MoMo.',
    color: '#AE2070',
    icon: '💗',
    fields: [
      {
        key: 'partnerCode',
        label: 'Partner code',
        placeholder: 'MOMO',
      },
      {
        key: 'accessKey',
        label: 'Access key',
        placeholder: 'MoMo access key',
      },
      {
        key: 'secretKey',
        label: 'Secret key',
        placeholder: 'MoMo secret key',
        type: 'password',
      },
    ],
  },
  {
    key: 'vnpay',
    label: 'VNPay',
    description: 'Thanh toan qua cong thanh toan VNPay.',
    color: '#005BAA',
    icon: '🔵',
    fields: [
      {
        key: 'tmnCode',
        label: 'TMN code',
        placeholder: 'VNPay TMN code',
      },
      {
        key: 'hashSecret',
        label: 'Hash secret',
        placeholder: 'VNPay hash secret',
        type: 'password',
      },
    ],
  },
  {
    key: 'zalopay',
    label: 'ZaloPay',
    description: 'Thanh toan qua vi ZaloPay.',
    color: '#0068FF',
    icon: '⚡',
    fields: [
      {
        key: 'appId',
        label: 'App ID',
        placeholder: 'ZaloPay app id',
      },
      {
        key: 'key1',
        label: 'Key 1',
        placeholder: 'ZaloPay key 1',
        type: 'password',
      },
      {
        key: 'key2',
        label: 'Key 2',
        placeholder: 'ZaloPay key 2',
        type: 'password',
      },
    ],
  },
];

const PROVIDER_LABELS: Record<string, { label: string; color: string }> = {
  cod: { label: 'COD', color: '#6b7280' },
  bank_transfer: { label: 'Chuyen khoan', color: '#0065AC' },
  momo: { label: 'MoMo', color: '#AE2070' },
  vnpay: { label: 'VNPay', color: '#005BAA' },
  zalopay: { label: 'ZaloPay', color: '#0068FF' },
  paypal: { label: 'PayPal', color: '#003087' },
};

const STATUS_CFG: Record<TxStatus, { label: string; cls: string }> = {
  pending: { label: 'Cho xu ly', cls: 'bg-amber-100 text-amber-700' },
  success: { label: 'Thanh cong', cls: 'bg-emerald-100 text-emerald-700' },
  failed: { label: 'That bai', cls: 'bg-red-100 text-red-700' },
};

function formatVND(amount: string | number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(Number(amount));
}

function mergePaymentSettings(
  settings?: Partial<PaymentSettings> | null,
): PaymentSettings {
  const next: PaymentSettings = {
    cod: { ...DEFAULT_PAYMENT_SETTINGS.cod },
    bank_transfer: { ...DEFAULT_PAYMENT_SETTINGS.bank_transfer },
    momo: { ...DEFAULT_PAYMENT_SETTINGS.momo },
    vnpay: { ...DEFAULT_PAYMENT_SETTINGS.vnpay },
    zalopay: { ...DEFAULT_PAYMENT_SETTINGS.zalopay },
  };
  if (!settings) {
    return next;
  }

  for (const method of PAYMENT_METHODS) {
    next[method.key] = {
      ...next[method.key],
      ...(settings[method.key] ?? {}),
    };
  }

  return next;
}

function mergeSmtpConfig(settings?: Partial<SmtpConfig> | null): SmtpConfig {
  return {
    ...DEFAULT_SMTP_CONFIG,
    ...(settings ?? {}),
  };
}

function resolvePaymentTab(value: string | null): PaymentTab {
  return value === 'transactions' || value === 'smtp' ? value : 'config';
}

export default function Payments() {
  const { language } = useLanguage();
  const isVi = language === 'vi';
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<PaymentTab>(() =>
    resolvePaymentTab(searchParams.get('tab')),
  );

  const [config, setConfig] = useState<PaymentSettings>(
    DEFAULT_PAYMENT_SETTINGS,
  );
  const [smtp, setSmtp] = useState<SmtpConfig>(DEFAULT_SMTP_CONFIG);
  const [configLoading, setConfigLoading] = useState(true);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [smtpSaving, setSmtpSaving] = useState(false);
  const [savedKey, setSavedKey] = useState<string | null>(null);

  const [items, setItems] = useState<TxItem[]>([]);
  const [meta, setMeta] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [filterProvider, setFilterProvider] = useState(
    searchParams.get('provider') ?? '',
  );
  const [filterStatus, setFilterStatus] = useState(
    searchParams.get('status') ?? '',
  );
  const [page, setPage] = useState(Number(searchParams.get('page') ?? '1'));

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(isVi ? 'vi-VN' : 'en-US', {
        dateStyle: 'short',
        timeStyle: 'short',
      }),
    [isVi],
  );

  useEffect(() => {
    const nextTab = resolvePaymentTab(searchParams.get('tab'));
    setActiveTab((current) => (current === nextTab ? current : nextTab));
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    setConfigLoading(true);

    void apiClient
      .get<AdminCommerceSettings>('/settings/admin/commerce')
      .then((data) => {
        if (cancelled) {
          return;
        }

        setConfig(mergePaymentSettings(data.payments));
        setSmtp(mergeSmtpConfig(data.smtp));
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          showToast({
            tone: 'error',
            title: 'Khong tai duoc cau hinh thanh toan',
            description: error instanceof Error ? error.message : '',
          });
        }
      })
      .finally(() => {
        if (!cancelled) {
          setConfigLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [showToast]);

  useEffect(() => {
    const next = new URLSearchParams();
    next.set('tab', activeTab);

    if (activeTab === 'transactions') {
      if (search.trim()) {
        next.set('search', search.trim());
      }
      if (filterProvider) {
        next.set('provider', filterProvider);
      }
      if (filterStatus) {
        next.set('status', filterStatus);
      }
      if (page > 1) {
        next.set('page', String(page));
      }
    }

    setSearchParams(next, { replace: true });
  }, [
    activeTab,
    filterProvider,
    filterStatus,
    page,
    search,
    setSearchParams,
  ]);

  useEffect(() => {
    setPage(1);
  }, [filterProvider, filterStatus, search]);

  useEffect(() => {
    if (activeTab !== 'transactions') {
      return;
    }

    let cancelled = false;
    setLoading(true);
    const query = new URLSearchParams({
      page: String(page),
      limit: '20',
    });
    if (filterProvider) {
      query.set('provider', filterProvider);
    }
    if (filterStatus) {
      query.set('status', filterStatus);
    }

    void apiClient
      .get<TxResponse>(`/payments/admin/transactions?${query.toString()}`)
      .then((data) => {
        if (cancelled) {
          return;
        }

        setItems(data.items ?? []);
        setMeta(data.meta);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          showToast({
            tone: 'error',
            title: 'Khong tai duoc giao dich',
            description: error instanceof Error ? error.message : '',
          });
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    activeTab,
    filterProvider,
    filterStatus,
    page,
    reloadKey,
    showToast,
  ]);

  const filteredItems = search.trim()
    ? items.filter((item) => {
        const normalizedSearch = search.toLowerCase();
        return (
          item.transactionRef.toLowerCase().includes(normalizedSearch) ||
          item.orderId.toLowerCase().includes(normalizedSearch) ||
          item.user?.username?.toLowerCase().includes(normalizedSearch) ||
          item.user?.email?.toLowerCase().includes(normalizedSearch)
        );
      })
    : items;

  const totalSuccess = items.filter(
    (item) => item.transactionStatus === 'success',
  ).length;
  const totalFailed = items.filter(
    (item) => item.transactionStatus === 'failed',
  ).length;
  const totalRevenue = items
    .filter((item) => item.transactionStatus === 'success')
    .reduce((sum, item) => sum + Number(item.amount), 0);

  const handleToggle = (key: PaymentMethodKey) => {
    setConfig((current) => ({
      ...current,
      [key]: {
        ...current[key],
        isActive: !current[key].isActive,
      },
    }));
  };

  const handleDescChange = (key: PaymentMethodKey, value: string) => {
    setConfig((current) => ({
      ...current,
      [key]: {
        ...current[key],
        description: value,
      },
    }));
  };

  const handleFieldChange = (
    key: PaymentMethodKey,
    field: MethodFieldKey,
    value: string,
  ) => {
    setConfig((current) => ({
      ...current,
      [key]: {
        ...current[key],
        [field]: value,
      },
    }));
  };

  const persistPaymentSettings = async (
    successTitle: string,
    key?: PaymentMethodKey,
  ) => {
    setPaymentSaving(true);
    try {
      const saved = await apiClient.put<PaymentSettings>(
        '/settings/admin/payments',
        { payments: config },
      );
      setConfig(mergePaymentSettings(saved));
      if (key) {
        setSavedKey(key);
        window.setTimeout(() => setSavedKey(null), 2000);
      }
      showToast({ tone: 'success', title: successTitle });
    } catch (error) {
      showToast({
        tone: 'error',
        title: 'Khong luu duoc cau hinh thanh toan',
        description: error instanceof Error ? error.message : '',
      });
    } finally {
      setPaymentSaving(false);
    }
  };

  const handleSaveMethod = async (key: PaymentMethodKey) => {
    await persistPaymentSettings('Da luu cau hinh thanh toan', key);
  };

  const handleSaveAll = async () => {
    await persistPaymentSettings('Da luu tat ca cau hinh thanh toan');
  };

  const handleSaveSmtp = async () => {
    setSmtpSaving(true);
    try {
      const saved = await apiClient.put<SmtpConfig>('/settings/admin/smtp', {
        smtp,
      });
      setSmtp(mergeSmtpConfig(saved));
      showToast({ tone: 'success', title: 'Da luu cau hinh SMTP' });
    } catch (error) {
      showToast({
        tone: 'error',
        title: 'Khong luu duoc cau hinh SMTP',
        description: error instanceof Error ? error.message : '',
      });
    } finally {
      setSmtpSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-primary">
            {isVi ? 'Quan ly thanh toan' : 'Payment Management'}
          </h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            {isVi
              ? 'Cau hinh cong thanh toan, SMTP va theo doi giao dich.'
              : 'Configure payment gateways, SMTP and track transactions.'}
          </p>
        </div>
        {activeTab === 'config' && (
          <button
            type="button"
            onClick={() => void handleSaveAll()}
            disabled={configLoading || paymentSaving}
            className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-primary/90 disabled:opacity-50"
          >
            <Save size={15} /> Luu tat ca
          </button>
        )}
      </div>

      <div className="flex gap-1 rounded-2xl border border-on-surface/8 bg-surface p-1 w-fit">
        {([
          {
            id: 'config',
            label: isVi ? 'Phuong thuc thanh toan' : 'Payment methods',
            icon: Settings,
          },
          {
            id: 'smtp',
            label: isVi ? 'SMTP / Email' : 'SMTP / Email',
            icon: Mail,
          },
          {
            id: 'transactions',
            label: isVi ? 'Lich su giao dich' : 'Transactions',
            icon: BarChart3,
          },
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

      {activeTab === 'config' && (
        <>
          {configLoading ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : (
            <div className="space-y-4">
              {PAYMENT_METHODS.map((method) => {
                const cfg = config[method.key];
                const isSaved = savedKey === method.key;
                return (
                  <section
                    key={method.key}
                    className={`overflow-hidden rounded-[2rem] border bg-white shadow-sm transition ${
                      cfg.isActive
                        ? 'border-on-surface/12'
                        : 'border-on-surface/6 opacity-70'
                    }`}
                  >
                    <div className="flex items-center gap-4 border-b border-on-surface/8 px-6 py-4">
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-xl"
                        style={{ background: `${method.color}18` }}
                      >
                        {method.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-black text-on-surface">
                          {method.label}
                        </p>
                        <p className="text-xs text-on-surface-variant">
                          {cfg.isActive
                            ? isVi
                              ? 'Dang hoat dong'
                              : 'Active'
                            : isVi
                              ? 'Dang tat'
                              : 'Inactive'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggle(method.key)}
                        className="shrink-0 transition"
                        title={cfg.isActive ? 'Tat' : 'Bat'}
                      >
                        {cfg.isActive ? (
                          <ToggleRight
                            size={36}
                            style={{ color: method.color }}
                          />
                        ) : (
                          <ToggleLeft
                            size={36}
                            className="text-on-surface-variant/30"
                          />
                        )}
                      </button>
                    </div>

                    <div className="grid gap-4 p-6 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant/60">
                          Mo ta hien thi cho khach
                        </label>
                        <textarea
                          value={cfg.description}
                          onChange={(event) =>
                            handleDescChange(method.key, event.target.value)
                          }
                          rows={3}
                          className="w-full resize-none rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none focus:border-primary/40"
                        />
                      </div>

                      <div className="rounded-2xl bg-surface p-4 text-sm text-on-surface-variant">
                        <p className="font-bold text-on-surface">Trang thai</p>
                        <p className="mt-1">
                          {cfg.isActive
                            ? 'Method nay se hien thi cho khach va duoc backend cho phep su dung.'
                            : 'Method nay se bi an o client va backend tu choi neu client goi truc tiep.'}
                        </p>
                      </div>

                      {method.fields?.map((field) => (
                        <div key={`${method.key}-${field.key}`}>
                          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-on-surface-variant/60">
                            {field.label}
                          </label>
                          <input
                            type={field.type ?? 'text'}
                            value={String(cfg[field.key] ?? '')}
                            onChange={(event) =>
                              handleFieldChange(
                                method.key,
                                field.key,
                                event.target.value,
                              )
                            }
                            placeholder={field.placeholder}
                            className="w-full rounded-2xl border border-on-surface/10 bg-surface px-4 py-2.5 text-sm outline-none focus:border-primary/40"
                          />
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-end border-t border-on-surface/6 px-6 py-3">
                      <button
                        type="button"
                        onClick={() => void handleSaveMethod(method.key)}
                        disabled={paymentSaving}
                        className="inline-flex items-center gap-2 rounded-xl border border-on-surface/10 px-4 py-2 text-sm font-semibold text-on-surface-variant transition hover:border-primary/40 hover:text-primary disabled:opacity-50"
                      >
                        {isSaved ? (
                          <>
                            <CheckCircle2
                              size={14}
                              className="text-emerald-500"
                            />{' '}
                            Da luu
                          </>
                        ) : (
                          <>
                            <Save size={14} /> Luu
                          </>
                        )}
                      </button>
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}

      {activeTab === 'smtp' && (
        <>
          {configLoading ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : (
            <section className="overflow-hidden rounded-[2rem] border border-on-surface/8 bg-white shadow-sm">
              <div className="border-b border-on-surface/8 px-6 py-5">
                <h2 className="text-lg font-black text-on-surface">
                  Cau hinh SMTP
                </h2>
                <p className="mt-1 text-sm text-on-surface-variant">
                  Newsletter va email notification se dung chung cau hinh nay.
                </p>
              </div>

              <div className="grid gap-4 p-6 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-on-surface-variant/60">
                    SMTP host
                  </label>
                  <input
                    value={smtp.host}
                    onChange={(event) =>
                      setSmtp((current) => ({
                        ...current,
                        host: event.target.value,
                      }))
                    }
                    placeholder="smtp.gmail.com"
                    className="w-full rounded-2xl border border-on-surface/10 bg-surface px-4 py-2.5 text-sm outline-none focus:border-primary/40"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-on-surface-variant/60">
                    Port
                  </label>
                  <input
                    value={smtp.port}
                    onChange={(event) =>
                      setSmtp((current) => ({
                        ...current,
                        port: event.target.value,
                      }))
                    }
                    placeholder="587"
                    className="w-full rounded-2xl border border-on-surface/10 bg-surface px-4 py-2.5 text-sm outline-none focus:border-primary/40"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-on-surface-variant/60">
                    Username
                  </label>
                  <input
                    value={smtp.user}
                    onChange={(event) =>
                      setSmtp((current) => ({
                        ...current,
                        user: event.target.value,
                      }))
                    }
                    placeholder="user@example.com"
                    className="w-full rounded-2xl border border-on-surface/10 bg-surface px-4 py-2.5 text-sm outline-none focus:border-primary/40"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-on-surface-variant/60">
                    Password / App password
                  </label>
                  <input
                    type="password"
                    value={smtp.pass}
                    onChange={(event) =>
                      setSmtp((current) => ({
                        ...current,
                        pass: event.target.value,
                      }))
                    }
                    placeholder="******"
                    className="w-full rounded-2xl border border-on-surface/10 bg-surface px-4 py-2.5 text-sm outline-none focus:border-primary/40"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-on-surface-variant/60">
                    From email
                  </label>
                  <input
                    value={smtp.from}
                    onChange={(event) =>
                      setSmtp((current) => ({
                        ...current,
                        from: event.target.value,
                      }))
                    }
                    placeholder="no-reply@example.com"
                    className="w-full rounded-2xl border border-on-surface/10 bg-surface px-4 py-2.5 text-sm outline-none focus:border-primary/40"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="inline-flex items-center gap-3 rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm text-on-surface">
                    <input
                      type="checkbox"
                      checked={smtp.secure}
                      onChange={(event) =>
                        setSmtp((current) => ({
                          ...current,
                          secure: event.target.checked,
                        }))
                      }
                      className="h-4 w-4 rounded border-on-surface/20"
                    />
                    Bat secure mode (thuong dung cho port 465)
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-on-surface/8 px-6 py-4">
                <p className="text-xs text-on-surface-variant">
                  Neu bo trong, backend se tiep tuc fallback sang bien moi truong
                  `.env`.
                </p>
                <button
                  type="button"
                  onClick={() => void handleSaveSmtp()}
                  disabled={smtpSaving}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white transition hover:bg-primary/90 disabled:opacity-50"
                >
                  {smtpSaving ? (
                    <LoaderCircle size={14} className="animate-spin" />
                  ) : (
                    <Save size={14} />
                  )}
                  Luu SMTP
                </button>
              </div>
            </section>
          )}
        </>
      )}

      {activeTab === 'transactions' && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Tong GD', value: meta.total, color: 'text-primary' },
              {
                label: 'Thanh cong',
                value: totalSuccess,
                color: 'text-emerald-600',
              },
              {
                label: 'That bai',
                value: totalFailed,
                color: 'text-red-500',
              },
              {
                label: 'Doanh thu (trang nay)',
                value: formatVND(totalRevenue),
                color: 'text-primary',
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-on-surface/8 bg-white p-4 text-center shadow-sm"
              >
                <p className={`text-2xl font-black ${stat.color}`}>
                  {stat.value}
                </p>
                <p className="mt-1 text-xs text-on-surface-variant">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>

          <section className="rounded-[2rem] border border-on-surface/8 bg-white p-5 shadow-sm">
            <div className="grid gap-3 sm:grid-cols-[1fr_180px_160px_auto]">
              <label className="relative">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50"
                />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Tim ma GD, don hang, nguoi dung..."
                  className="w-full rounded-2xl border border-on-surface/10 bg-surface py-3 pl-11 pr-4 text-sm outline-none focus:border-primary/40"
                />
              </label>

              <select
                value={filterProvider}
                onChange={(event) => setFilterProvider(event.target.value)}
                className="rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none"
              >
                <option value="">Tat ca phuong thuc</option>
                {Object.entries(PROVIDER_LABELS).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value.label}
                  </option>
                ))}
              </select>

              <select
                value={filterStatus}
                onChange={(event) => setFilterStatus(event.target.value)}
                className="rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none"
              >
                <option value="">Tat ca trang thai</option>
                <option value="pending">Cho xu ly</option>
                <option value="success">Thanh cong</option>
                <option value="failed">That bai</option>
              </select>

              <button
                type="button"
                onClick={() => setReloadKey((current) => current + 1)}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm font-semibold text-on-surface-variant transition hover:border-primary/30 hover:text-primary disabled:opacity-50"
              >
                <RefreshCw
                  size={15}
                  className={loading ? 'animate-spin' : ''}
                />
                Lam moi
              </button>
            </div>
          </section>

          <section className="overflow-hidden rounded-[2rem] border border-on-surface/8 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead className="border-b border-on-surface/8 bg-surface/70 text-[11px] font-black uppercase tracking-[0.18em] text-on-surface-variant/60">
                  <tr>
                    <th className="px-4 py-4">Ma giao dich</th>
                    <th className="px-4 py-4">Don hang</th>
                    <th className="px-4 py-4">Nguoi dung</th>
                    <th className="px-4 py-4">Phuong thuc</th>
                    <th className="px-4 py-4">So tien</th>
                    <th className="px-4 py-4 text-center">Trang thai</th>
                    <th className="px-4 py-4">Ngay</th>
                    <th className="px-4 py-4">Ma GW</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-on-surface/6 text-sm">
                  {loading ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-4 py-16 text-center text-on-surface-variant"
                      >
                        <span className="inline-flex items-center gap-2">
                          <LoaderCircle size={16} className="animate-spin" />{' '}
                          Dang tai...
                        </span>
                      </td>
                    </tr>
                  ) : filteredItems.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-4 py-16 text-center text-on-surface-variant"
                      >
                        <CreditCard
                          size={28}
                          className="mx-auto mb-3 text-primary/30"
                        />
                        Khong co giao dich
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((transaction) => {
                      const providerInfo =
                        PROVIDER_LABELS[transaction.provider] ?? {
                          label: transaction.provider,
                          color: '#6b7280',
                        };
                      const statusInfo =
                        STATUS_CFG[transaction.transactionStatus] ?? {
                          label: transaction.transactionStatus,
                          cls: 'bg-gray-100 text-gray-700',
                        };

                      return (
                        <tr
                          key={transaction.id}
                          className="hover:bg-surface/40"
                        >
                          <td className="px-4 py-3 font-mono text-xs text-on-surface-variant">
                            {transaction.transactionRef
                              .slice(-12)
                              .toUpperCase()}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs">
                            <span className="cursor-pointer text-primary hover:underline">
                              {transaction.orderId.slice(-8).toUpperCase()}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-on-surface-variant">
                            {transaction.user ? (
                              <div>
                                <p className="font-semibold text-on-surface">
                                  {transaction.user.username}
                                </p>
                                <p className="text-[11px] text-on-surface-variant/60">
                                  {transaction.user.email}
                                </p>
                              </div>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black text-white"
                              style={{ background: providerInfo.color }}
                            >
                              {providerInfo.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-bold text-on-surface">
                            {formatVND(transaction.amount)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${statusInfo.cls}`}
                            >
                              {statusInfo.label}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-on-surface-variant">
                            {dateFormatter.format(
                              new Date(transaction.createdAt),
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-on-surface-variant">
                            {transaction.gatewayCode ?? '—'}
                          </td>
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
                  Trang {meta.page}/{meta.totalPages} · {meta.total} giao dich
                </p>
                <div className="flex gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((current) => current - 1)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-on-surface/10 text-on-surface-variant transition hover:border-primary/30 hover:text-primary disabled:opacity-40"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    disabled={page >= meta.totalPages}
                    onClick={() => setPage((current) => current + 1)}
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
