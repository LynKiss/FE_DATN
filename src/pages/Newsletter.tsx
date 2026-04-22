import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  LoaderCircle,
  Mail,
  Pencil,
  Plus,
  Save,
  Send,
  Server,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { apiClient as api } from '../lib/api';
import { DEFAULT_SMTP_CONFIG, type SmtpConfig } from '../lib/commerce-settings';
import { useToast } from '../hooks/useToast';

type ActiveTab = 'subscribers' | 'campaigns' | 'automation';

type Subscriber = {
  id: string;
  email: string;
  name: string | null;
  status: 'active' | 'unsubscribed';
  createdAt: string;
};

type CampaignStatus = 'draft' | 'scheduled' | 'sent';

type Campaign = {
  id: string;
  subject: string;
  body: string;
  status: CampaignStatus;
  sentAt: string | null;
  scheduledAt: string | null;
  recipientCount: number;
  totalRecipientCount: number;
  createdAt: string;
};

type SubscriberPage = {
  items: Subscriber[];
  total: number;
  page: number;
  limit: number;
};

type AutomationSettings = {
  smtp: SmtpConfig & {
    isConfigured: boolean;
    source: 'settings' | 'env' | 'none';
  };
  scheduler: {
    isEnabled: boolean;
    cron: string;
    intervalMinutes: number;
  };
  scheduledCampaigns: {
    total: number;
    nextScheduledAt: string | null;
  };
};

const DEFAULT_AUTOMATION_SETTINGS: AutomationSettings = {
  smtp: {
    ...DEFAULT_SMTP_CONFIG,
    isConfigured: false,
    source: 'none',
  },
  scheduler: {
    isEnabled: true,
    cron: '* * * * *',
    intervalMinutes: 1,
  },
  scheduledCampaigns: {
    total: 0,
    nextScheduledAt: null,
  },
};

function formatDate(value: string | null) {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toDateTimeInputValue(value: string | null) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function getMinDateTimeInputValue() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function StatusBadge({ status }: { status: CampaignStatus }) {
  const cfg: Record<CampaignStatus, { label: string; cls: string }> = {
    draft: { label: 'Ban nhap', cls: 'bg-amber-100 text-amber-700' },
    scheduled: { label: 'Da len lich', cls: 'bg-sky-100 text-sky-700' },
    sent: { label: 'Da gui', cls: 'bg-emerald-100 text-emerald-700' },
  };

  const { label, cls } = cfg[status];
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${cls}`}>
      {label}
    </span>
  );
}

function StatCard({
  label,
  value,
  icon,
  accent = 'text-primary',
}: {
  label: string;
  value: string | number;
  icon?: ReactNode;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-on-surface/8 bg-white p-4 text-center shadow-sm">
      <p className={`flex items-center justify-center gap-1 text-2xl font-black ${accent}`}>
        {icon}
        {value}
      </p>
      <p className="mt-1 text-xs text-on-surface-variant">{label}</p>
    </div>
  );
}

export default function Newsletter() {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<ActiveTab>('subscribers');

  const [subscriberData, setSubscriberData] = useState<SubscriberPage | null>(null);
  const [subPage, setSubPage] = useState(1);
  const [subStatus, setSubStatus] = useState('');
  const [subLoading, setSubLoading] = useState(false);
  const [deletingSubId, setDeletingSubId] = useState<string | null>(null);

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignLoading, setCampaignLoading] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [deletingCamId, setDeletingCamId] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [formSubject, setFormSubject] = useState('');
  const [formBody, setFormBody] = useState('');
  const [formScheduledAt, setFormScheduledAt] = useState('');
  const [formSaving, setFormSaving] = useState(false);
  const [previewCampaign, setPreviewCampaign] = useState<Campaign | null>(null);

  const [automation, setAutomation] = useState<AutomationSettings>(
    DEFAULT_AUTOMATION_SETTINGS,
  );
  const [smtpForm, setSmtpForm] = useState<SmtpConfig>(DEFAULT_SMTP_CONFIG);
  const [automationLoading, setAutomationLoading] = useState(false);
  const [smtpSaving, setSmtpSaving] = useState(false);

  const previewRef = useRef<HTMLIFrameElement>(null);

  const campaignStats = useMemo(() => {
    const draftCount = campaigns.filter((campaign) => campaign.status === 'draft').length;
    const scheduledCount = campaigns.filter(
      (campaign) => campaign.status === 'scheduled',
    ).length;
    const sentCount = campaigns.filter((campaign) => campaign.status === 'sent').length;

    return {
      total: campaigns.length,
      draftCount,
      scheduledCount,
      sentCount,
    };
  }, [campaigns]);

  const totalPages = subscriberData ? Math.ceil(subscriberData.total / subscriberData.limit) : 1;
  const minScheduleValue = useMemo(() => getMinDateTimeInputValue(), []);

  const syncAutomationState = (next: AutomationSettings) => {
    setAutomation(next);
    setSmtpForm({
      host: next.smtp.host,
      port: next.smtp.port,
      user: next.smtp.user,
      pass: next.smtp.pass,
      from: next.smtp.from,
      secure: next.smtp.secure,
    });
  };

  const loadSubscribers = async (page = subPage, status = subStatus) => {
    setSubLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '50',
      });

      if (status) {
        params.set('status', status);
      }

      const data = await api.get<SubscriberPage>(
        `/newsletter/subscribers?${params.toString()}`,
      );
      setSubscriberData(data);
    } catch (error) {
      showToast({
        tone: 'error',
        title: 'Khong tai duoc danh sach nguoi dang ky',
        description: error instanceof Error ? error.message : '',
      });
    } finally {
      setSubLoading(false);
    }
  };

  const loadCampaigns = async () => {
    setCampaignLoading(true);
    try {
      const data = await api.get<Campaign[]>('/newsletter/campaigns');
      setCampaigns(Array.isArray(data) ? data : []);
    } catch (error) {
      showToast({
        tone: 'error',
        title: 'Khong tai duoc chien dich email',
        description: error instanceof Error ? error.message : '',
      });
    } finally {
      setCampaignLoading(false);
    }
  };

  const loadAutomation = async () => {
    setAutomationLoading(true);
    try {
      const data = await api.get<AutomationSettings>('/newsletter/automation');
      syncAutomationState(data);
    } catch (error) {
      showToast({
        tone: 'error',
        title: 'Khong tai duoc cau hinh gui mail tu dong',
        description: error instanceof Error ? error.message : '',
      });
    } finally {
      setAutomationLoading(false);
    }
  };

  const refreshCampaignArea = async () => {
    await Promise.all([loadCampaigns(), loadAutomation()]);
  };

  useEffect(() => {
    if (activeTab === 'subscribers') {
      void loadSubscribers(subPage, subStatus);
    }
  }, [activeTab, subPage, subStatus]);

  useEffect(() => {
    if (activeTab === 'campaigns' || activeTab === 'automation') {
      void loadAutomation();
    }

    if (activeTab === 'campaigns') {
      void loadCampaigns();
    }
  }, [activeTab]);

  useEffect(() => {
    if (previewCampaign && previewRef.current) {
      const doc = previewRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(previewCampaign.body);
        doc.close();
      }
    }
  }, [previewCampaign]);

  const openEditor = (campaign?: Campaign) => {
    setEditingCampaign(campaign ?? null);
    setFormSubject(campaign?.subject ?? '');
    setFormBody(campaign?.body ?? '');
    setFormScheduledAt(toDateTimeInputValue(campaign?.scheduledAt ?? null));
    setShowEditor(true);
  };

  const handleDeleteSubscriber = async (id: string) => {
    if (!window.confirm('Xoa nguoi dang ky nay?')) {
      return;
    }

    setDeletingSubId(id);
    try {
      await api.delete(`/newsletter/subscribers/${id}`);
      showToast({ tone: 'success', title: 'Da xoa nguoi dang ky' });
      await loadSubscribers();
    } catch (error) {
      showToast({
        tone: 'error',
        title: 'Xoa that bai',
        description: error instanceof Error ? error.message : '',
      });
    } finally {
      setDeletingSubId(null);
    }
  };

  const handleSaveCampaign = async () => {
    if (!formSubject.trim() || !formBody.trim()) {
      return;
    }

    setFormSaving(true);
    try {
      const payload = {
        subject: formSubject.trim(),
        body: formBody,
        scheduledAt: formScheduledAt
          ? new Date(formScheduledAt).toISOString()
          : null,
      };

      if (editingCampaign) {
        await api.put(`/newsletter/campaigns/${editingCampaign.id}`, payload);
      } else {
        await api.post('/newsletter/campaigns', payload);
      }

      setShowEditor(false);
      showToast({
        tone: 'success',
        title: editingCampaign ? 'Da cap nhat chien dich' : 'Da tao chien dich',
      });
      await refreshCampaignArea();
    } catch (error) {
      showToast({
        tone: 'error',
        title: 'Khong luu duoc chien dich',
        description: error instanceof Error ? error.message : '',
      });
    } finally {
      setFormSaving(false);
    }
  };

  const handleSendCampaign = async (id: string, subject: string) => {
    if (!window.confirm(`Gui chien dich "${subject}" ngay bay gio?`)) {
      return;
    }

    setSendingId(id);
    try {
      const result = await api.post<{ sent: number; total: number }>(
        `/newsletter/campaigns/${id}/send`,
      );
      showToast({
        tone: 'success',
        title: `Da gui ${result.sent}/${result.total} email`,
      });
      await refreshCampaignArea();
    } catch (error) {
      showToast({
        tone: 'error',
        title: 'Gui chien dich that bai',
        description: error instanceof Error ? error.message : '',
      });
    } finally {
      setSendingId(null);
    }
  };

  const handleDeleteCampaign = async (id: string) => {
    if (!window.confirm('Xoa chien dich nay?')) {
      return;
    }

    setDeletingCamId(id);
    try {
      await api.delete(`/newsletter/campaigns/${id}`);
      showToast({ tone: 'success', title: 'Da xoa chien dich' });
      await refreshCampaignArea();
    } catch (error) {
      showToast({
        tone: 'error',
        title: 'Xoa that bai',
        description: error instanceof Error ? error.message : '',
      });
    } finally {
      setDeletingCamId(null);
    }
  };

  const handleSaveSmtp = async () => {
    setSmtpSaving(true);
    try {
      const smtp = await api.put<AutomationSettings['smtp']>(
        '/newsletter/automation/smtp',
        { smtp: smtpForm },
      );

      setAutomation((current) => ({
        ...current,
        smtp: {
          ...smtp,
        },
      }));

      setSmtpForm({
        host: smtp.host,
        port: smtp.port,
        user: smtp.user,
        pass: smtp.pass,
        from: smtp.from,
        secure: smtp.secure,
      });

      showToast({ tone: 'success', title: 'Da luu cau hinh SMTP' });
      await loadAutomation();
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
      <div>
        <h1 className="text-4xl font-black tracking-tight text-primary">
          Newsletter & Email
        </h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          Quan ly subscriber, chien dich email va cau hinh gui mail tu dong.
        </p>
      </div>

      <div className="flex w-fit gap-1 rounded-2xl border border-on-surface/8 bg-surface p-1">
        {([
          { id: 'subscribers', label: 'Nguoi dang ky', icon: Users },
          { id: 'campaigns', label: 'Chien dich', icon: FileText },
          { id: 'automation', label: 'Tu dong gui', icon: Mail },
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
            {id === 'subscribers' && subscriberData ? (
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                  activeTab === id ? 'bg-white/15 text-white' : 'bg-primary/10 text-primary'
                }`}
              >
                {subscriberData.total}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {activeTab === 'subscribers' && (
        <section className="overflow-hidden rounded-[2rem] border border-on-surface/8 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-on-surface/8 px-6 py-5">
            <div className="flex items-center gap-3">
              <select
                value={subStatus}
                onChange={(event) => {
                  setSubStatus(event.target.value);
                  setSubPage(1);
                }}
                className="rounded-2xl border border-on-surface/10 bg-surface px-4 py-2.5 text-sm outline-none"
              >
                <option value="">Tat ca trang thai</option>
                <option value="active">Dang dang ky</option>
                <option value="unsubscribed">Da huy</option>
              </select>
            </div>
            <p className="text-sm text-on-surface-variant">
              {subscriberData ? `${subscriberData.total} nguoi dang ky` : ''}
            </p>
          </div>

          {subLoading ? (
            <div className="flex justify-center py-16">
              <LoaderCircle size={28} className="animate-spin text-primary" />
            </div>
          ) : (subscriberData?.items.length ?? 0) === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant">
              <Mail size={36} className="mb-3 text-primary/30" />
              <p className="text-sm">Chua co nguoi dang ky nao</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left">
                  <thead className="border-b border-on-surface/8 bg-surface/70 text-[11px] font-black uppercase tracking-[0.18em] text-on-surface-variant/60">
                    <tr>
                      <th className="px-5 py-4">Email</th>
                      <th className="px-5 py-4">Ten</th>
                      <th className="px-5 py-4">Trang thai</th>
                      <th className="px-5 py-4">Ngay dang ky</th>
                      <th className="px-5 py-4 text-right">Hanh dong</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-on-surface/6 text-sm">
                    {subscriberData?.items.map((subscriber) => (
                      <tr key={subscriber.id} className="hover:bg-surface/40">
                        <td className="px-5 py-4 font-medium text-on-surface">
                          {subscriber.email}
                        </td>
                        <td className="px-5 py-4 text-on-surface-variant">
                          {subscriber.name || '-'}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${
                              subscriber.status === 'active'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {subscriber.status === 'active' ? 'Dang dang ky' : 'Da huy'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-on-surface-variant">
                          {formatDate(subscriber.createdAt)}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => void handleDeleteSubscriber(subscriber.id)}
                            disabled={deletingSubId === subscriber.id}
                            className="rounded-xl p-2 text-on-surface-variant transition hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-on-surface/8 px-6 py-4">
                  <p className="text-sm text-on-surface-variant">
                    Trang {subPage}/{totalPages}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSubPage((current) => Math.max(1, current - 1))}
                      disabled={subPage === 1}
                      className="rounded-xl border border-on-surface/10 px-4 py-2 text-sm font-semibold text-on-surface-variant transition hover:border-primary/30 hover:text-primary disabled:opacity-40"
                    >
                      Truoc
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setSubPage((current) => Math.min(totalPages, current + 1))
                      }
                      disabled={subPage === totalPages}
                      className="rounded-xl border border-on-surface/10 px-4 py-2 text-sm font-semibold text-on-surface-variant transition hover:border-primary/30 hover:text-primary disabled:opacity-40"
                    >
                      Tiep
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {activeTab === 'campaigns' && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="Tong chien dich"
              value={campaignStats.total}
              icon={<FileText size={14} />}
            />
            <StatCard
              label="Ban nhap"
              value={campaignStats.draftCount}
              icon={<Pencil size={14} />}
              accent="text-amber-600"
            />
            <StatCard
              label="Da len lich"
              value={campaignStats.scheduledCount}
              icon={<CalendarClock size={14} />}
              accent="text-sky-600"
            />
            <StatCard
              label="Da gui"
              value={campaignStats.sentCount}
              icon={<CheckCircle2 size={14} />}
              accent="text-emerald-600"
            />
          </div>

          <section
            className={`rounded-[2rem] border px-5 py-4 shadow-sm ${
              automation.smtp.isConfigured
                ? 'border-emerald-200 bg-emerald-50'
                : 'border-amber-200 bg-amber-50'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black text-on-surface">
                  {automation.smtp.isConfigured
                    ? 'He thong san sang gui mail tu dong'
                    : 'Chua co SMTP de gui mail tu dong'}
                </p>
                <p className="mt-1 text-sm text-on-surface-variant">
                  Server quet chien dich den han moi {automation.scheduler.intervalMinutes}{' '}
                  phut. Lan gui tiep theo:{' '}
                  {automation.scheduledCampaigns.nextScheduledAt
                    ? formatDate(automation.scheduledCampaigns.nextScheduledAt)
                    : 'chua co'}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('automation')}
                className="rounded-2xl bg-white px-4 py-2 text-sm font-bold text-primary shadow-sm transition hover:bg-primary hover:text-white"
              >
                Mo cau hinh gui tu dong
              </button>
            </div>
          </section>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => openEditor()}
              className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-bold text-white transition hover:bg-primary/90"
            >
              <Plus size={16} />
              Tao chien dich moi
            </button>
          </div>

          {campaignLoading ? (
            <div className="flex justify-center py-16">
              <LoaderCircle size={28} className="animate-spin text-primary" />
            </div>
          ) : campaigns.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-[2rem] border border-on-surface/8 bg-white py-16 text-on-surface-variant shadow-sm">
              <FileText size={40} className="mb-3 text-primary/30" />
              <p className="text-sm">Chua co chien dich nao. Tao chien dich dau tien.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {campaigns.map((campaign) => (
                <section
                  key={campaign.id}
                  className="rounded-[2rem] border border-on-surface/8 bg-white px-6 py-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-start gap-4">
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                        campaign.status === 'sent'
                          ? 'bg-emerald-100 text-emerald-600'
                          : campaign.status === 'scheduled'
                            ? 'bg-sky-100 text-sky-600'
                            : 'bg-amber-100 text-amber-600'
                      }`}
                    >
                      {campaign.status === 'sent' ? (
                        <CheckCircle2 size={20} />
                      ) : campaign.status === 'scheduled' ? (
                        <CalendarClock size={20} />
                      ) : (
                        <Clock size={20} />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="truncate text-lg font-black text-on-surface">
                          {campaign.subject}
                        </h2>
                        <StatusBadge status={campaign.status} />
                      </div>
                      <p className="mt-2 text-sm text-on-surface-variant">
                        {campaign.status === 'sent'
                          ? `Da gui ${campaign.recipientCount}/${campaign.totalRecipientCount} user vao ${formatDate(campaign.sentAt)}`
                          : campaign.status === 'scheduled'
                            ? `Hen gui vao ${formatDate(campaign.scheduledAt)}`
                            : `Tao luc ${formatDate(campaign.createdAt)}`}
                      </p>
                      {campaign.status === 'sent' &&
                      campaign.totalRecipientCount > campaign.recipientCount ? (
                        <p className="mt-1 text-xs font-semibold text-amber-700">
                          Con {campaign.totalRecipientCount - campaign.recipientCount} user gui that bai.
                        </p>
                      ) : null}
                      <p className="mt-2 line-clamp-2 text-sm text-on-surface-variant">
                        {campaign.body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setPreviewCampaign(campaign)}
                        className="rounded-xl p-2 text-on-surface-variant transition hover:bg-surface hover:text-primary"
                        title="Xem truoc"
                      >
                        <Eye size={16} />
                      </button>

                      {(campaign.status === 'draft' || campaign.status === 'scheduled') && (
                        <>
                          <button
                            type="button"
                            onClick={() => openEditor(campaign)}
                            className="rounded-xl p-2 text-on-surface-variant transition hover:bg-surface hover:text-primary"
                            title="Chinh sua"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleSendCampaign(campaign.id, campaign.subject)}
                            disabled={sendingId === campaign.id}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-bold text-white transition hover:bg-primary/90 disabled:opacity-50"
                          >
                            {sendingId === campaign.id ? (
                              <LoaderCircle size={14} className="animate-spin" />
                            ) : (
                              <Send size={14} />
                            )}
                            Gui
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteCampaign(campaign.id)}
                            disabled={deletingCamId === campaign.id}
                            className="rounded-xl p-2 text-on-surface-variant transition hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
                            title="Xoa"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'automation' && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard
              label="SMTP"
              value={automation.smtp.isConfigured ? 'San sang' : 'Chua xong'}
              icon={<Server size={14} />}
              accent={automation.smtp.isConfigured ? 'text-emerald-600' : 'text-amber-600'}
            />
            <StatCard
              label="Tan suat quet"
              value={`Moi ${automation.scheduler.intervalMinutes} phut`}
              icon={<Clock size={14} />}
              accent="text-sky-600"
            />
            <StatCard
              label="Cho gui"
              value={automation.scheduledCampaigns.total}
              icon={<CalendarClock size={14} />}
              accent="text-primary"
            />
          </div>

          <section className="overflow-hidden rounded-[2rem] border border-on-surface/8 bg-white shadow-sm">
            <div className="border-b border-on-surface/8 px-6 py-5">
              <h2 className="text-lg font-black text-on-surface">
                Cau hinh gui mail tu dong
              </h2>
              <p className="mt-1 text-sm text-on-surface-variant">
                He thong se tu dong gui campaign co `scheduledAt` den han. SMTP nay
                cung duoc dung cho email thong bao.
              </p>
            </div>

            {automationLoading ? (
              <div className="flex justify-center py-16">
                <LoaderCircle size={28} className="animate-spin text-primary" />
              </div>
            ) : (
              <>
                <div className="grid gap-3 border-b border-on-surface/8 bg-surface/50 px-6 py-4 sm:grid-cols-3">
                  <div className="rounded-2xl bg-white p-4 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant/60">
                      Trang thai SMTP
                    </p>
                    <p className="mt-2 text-lg font-black text-on-surface">
                      {automation.smtp.isConfigured ? 'Da san sang' : 'Chua day du'}
                    </p>
                    <p className="mt-1 text-sm text-on-surface-variant">
                      Nguon cau hinh: {automation.smtp.source === 'settings'
                        ? 'admin settings'
                        : automation.smtp.source === 'env'
                          ? '.env fallback'
                          : 'chua co'}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-white p-4 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant/60">
                      Cron scheduler
                    </p>
                    <p className="mt-2 text-lg font-black text-on-surface">
                      {automation.scheduler.cron}
                    </p>
                    <p className="mt-1 text-sm text-on-surface-variant">
                      Server quet chien dich moi {automation.scheduler.intervalMinutes}{' '}
                      phut.
                    </p>
                  </div>

                  <div className="rounded-2xl bg-white p-4 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant/60">
                      Lan gui sap toi
                    </p>
                    <p className="mt-2 text-lg font-black text-on-surface">
                      {automation.scheduledCampaigns.nextScheduledAt
                        ? formatDate(automation.scheduledCampaigns.nextScheduledAt)
                        : 'Chua co'}
                    </p>
                    <p className="mt-1 text-sm text-on-surface-variant">
                      Dang cho gui: {automation.scheduledCampaigns.total} chien dich
                    </p>
                  </div>
                </div>

                {!automation.smtp.isConfigured && (
                  <div className="mx-6 mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    <div className="flex items-start gap-2">
                      <AlertCircle size={16} className="mt-0.5 shrink-0" />
                      <p>
                        Chua co du cau hinh SMTP. Campaign len lich se khong gui duoc
                        cho den khi host, user va password hop le duoc luu.
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid gap-4 p-6 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-on-surface-variant/60">
                      SMTP host
                    </label>
                    <input
                      value={smtpForm.host}
                      onChange={(event) =>
                        setSmtpForm((current) => ({
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
                      value={smtpForm.port}
                      onChange={(event) =>
                        setSmtpForm((current) => ({
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
                      value={smtpForm.user}
                      onChange={(event) =>
                        setSmtpForm((current) => ({
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
                      value={smtpForm.pass}
                      onChange={(event) =>
                        setSmtpForm((current) => ({
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
                      value={smtpForm.from}
                      onChange={(event) =>
                        setSmtpForm((current) => ({
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
                        checked={smtpForm.secure}
                        onChange={(event) =>
                          setSmtpForm((current) => ({
                            ...current,
                            secure: event.target.checked,
                          }))
                        }
                        className="h-4 w-4 rounded border-on-surface/20"
                      />
                      Bat secure mode (thuong dung voi port 465)
                    </label>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-on-surface/8 px-6 py-4">
                  <p className="text-xs text-on-surface-variant">
                    Neu de trong, backend van co the fallback sang SMTP trong `.env`.
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
              </>
            )}
          </section>
        </>
      )}

      {showEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="flex w-full max-w-3xl flex-col rounded-[2rem] bg-white shadow-2xl"
            style={{ maxHeight: '90vh' }}
          >
            <div className="flex items-center justify-between border-b border-on-surface/8 px-6 py-5">
              <h2 className="text-lg font-black text-on-surface">
                {editingCampaign ? 'Chinh sua chien dich' : 'Tao chien dich moi'}
              </h2>
              <button
                type="button"
                onClick={() => setShowEditor(false)}
                className="rounded-xl p-2 text-on-surface-variant transition hover:bg-surface"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto p-6">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-on-surface">
                  Subject <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formSubject}
                  onChange={(event) => setFormSubject(event.target.value)}
                  placeholder="VD: Khuyen mai thang 5"
                  className="w-full rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none focus:border-primary/40"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-on-surface">
                  Len lich gui (tuy chon)
                </label>
                <input
                  type="datetime-local"
                  value={formScheduledAt}
                  onChange={(event) => setFormScheduledAt(event.target.value)}
                  min={minScheduleValue}
                  className="w-full rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none focus:border-primary/40"
                />
                <p className="mt-1 text-xs text-on-surface-variant">
                  Neu de trong, campaign se o trang thai ban nhap. Neu co thoi gian,
                  cron se gui tu dong khi den han.
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-on-surface">
                  Noi dung email (HTML) <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formBody}
                  onChange={(event) => setFormBody(event.target.value)}
                  rows={12}
                  placeholder={'<h2>Xin chao</h2>\n<p>Chung toi co uu dai moi danh cho ban...</p>'}
                  className="w-full rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 font-mono text-sm outline-none focus:border-primary/40"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-on-surface/8 px-6 py-4">
              <button
                type="button"
                onClick={() => setShowEditor(false)}
                className="rounded-xl border border-on-surface/10 px-4 py-2 text-sm font-semibold text-on-surface hover:bg-surface"
              >
                Huy
              </button>
              <button
                type="button"
                onClick={() => void handleSaveCampaign()}
                disabled={formSaving || !formSubject.trim() || !formBody.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-sm font-bold text-white transition hover:bg-primary/90 disabled:opacity-50"
              >
                {formSaving ? (
                  <LoaderCircle size={14} className="animate-spin" />
                ) : (
                  <Save size={14} />
                )}
                Luu chien dich
              </button>
            </div>
          </div>
        </div>
      )}

      {previewCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="flex w-full max-w-3xl flex-col rounded-[2rem] bg-white shadow-2xl"
            style={{ maxHeight: '90vh' }}
          >
            <div className="flex items-center justify-between border-b border-on-surface/8 px-6 py-5">
              <h2 className="text-lg font-black text-on-surface">
                Xem truoc: {previewCampaign.subject}
              </h2>
              <button
                type="button"
                onClick={() => setPreviewCampaign(null)}
                className="rounded-xl p-2 text-on-surface-variant transition hover:bg-surface"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-hidden p-4">
              <iframe
                ref={previewRef}
                title="Newsletter preview"
                className="h-full w-full rounded-2xl border border-on-surface/8"
                style={{ minHeight: 420 }}
                sandbox="allow-same-origin"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
