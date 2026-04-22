import { useEffect, useRef, useState } from 'react';
import {
  Mail,
  Trash2,
  Send,
  Plus,
  Users,
  FileText,
  CheckCircle2,
  Clock,
  Eye,
  X,
  Pencil,
} from 'lucide-react';
import { apiClient as api } from '../lib/api';

type Subscriber = {
  id: string;
  email: string;
  name: string | null;
  status: 'active' | 'unsubscribed';
  createdAt: string;
};

type Campaign = {
  id: string;
  subject: string;
  body: string;
  status: 'draft' | 'sent';
  sentAt: string | null;
  recipientCount: number;
  createdAt: string;
};

type SubscriberPage = {
  items: Subscriber[];
  total: number;
  page: number;
  limit: number;
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function Newsletter() {
  const [activeTab, setActiveTab] = useState<'subscribers' | 'campaigns'>('subscribers');

  // ─── SUBSCRIBERS ────────────────────────────────────────────────────────────
  const [subscriberData, setSubscriberData] = useState<SubscriberPage | null>(null);
  const [subPage, setSubPage] = useState(1);
  const [subStatus, setSubStatus] = useState('');
  const [subLoading, setSubLoading] = useState(false);
  const [deletingSubId, setDeletingSubId] = useState<string | null>(null);

  const loadSubscribers = async (page = subPage, status = subStatus) => {
    setSubLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (status) params.set('status', status);
      const data = await api.get<SubscriberPage>(`/newsletter/subscribers?${params}`);
      setSubscriberData(data);
    } catch {}
    setSubLoading(false);
  };

  useEffect(() => {
    if (activeTab === 'subscribers') void loadSubscribers(subPage, subStatus);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, subPage, subStatus]);

  const handleDeleteSubscriber = async (id: string) => {
    if (!confirm('Xóa người đăng ký này?')) return;
    setDeletingSubId(id);
    try {
      await api.delete(`/newsletter/subscribers/${id}`);
      void loadSubscribers();
    } catch {}
    setDeletingSubId(null);
  };

  // ─── CAMPAIGNS ──────────────────────────────────────────────────────────────
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignLoading, setCampaignLoading] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [deletingCamId, setDeletingCamId] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [formSubject, setFormSubject] = useState('');
  const [formBody, setFormBody] = useState('');
  const [formSaving, setFormSaving] = useState(false);
  const [previewCampaign, setPreviewCampaign] = useState<Campaign | null>(null);
  const previewRef = useRef<HTMLIFrameElement>(null);

  const loadCampaigns = async () => {
    setCampaignLoading(true);
    try {
      const data = await api.get<Campaign[]>('/newsletter/campaigns');
      setCampaigns(Array.isArray(data) ? data : []);
    } catch {}
    setCampaignLoading(false);
  };

  useEffect(() => {
    if (activeTab === 'campaigns') void loadCampaigns();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const openEditor = (campaign?: Campaign) => {
    setEditingCampaign(campaign ?? null);
    setFormSubject(campaign?.subject ?? '');
    setFormBody(campaign?.body ?? '');
    setShowEditor(true);
  };

  const handleSaveCampaign = async () => {
    if (!formSubject.trim() || !formBody.trim()) return;
    setFormSaving(true);
    try {
      if (editingCampaign) {
        await api.put(`/newsletter/campaigns/${editingCampaign.id}`, {
          subject: formSubject,
          body: formBody,
        });
      } else {
        await api.post('/newsletter/campaigns', { subject: formSubject, body: formBody });
      }
      setShowEditor(false);
      void loadCampaigns();
    } catch {}
    setFormSaving(false);
  };

  const handleSendCampaign = async (id: string, subject: string) => {
    if (!confirm(`Gửi chiến dịch "${subject}" tới tất cả người đăng ký?`)) return;
    setSendingId(id);
    try {
      const result = await api.post<{ sent: number; total: number }>(`/newsletter/campaigns/${id}/send`);
      alert(`Đã gửi thành công ${result.sent}/${result.total} email`);
      void loadCampaigns();
    } catch {}
    setSendingId(null);
  };

  const handleDeleteCampaign = async (id: string) => {
    if (!confirm('Xóa chiến dịch này?')) return;
    setDeletingCamId(id);
    try {
      await api.delete(`/newsletter/campaigns/${id}`);
      void loadCampaigns();
    } catch {}
    setDeletingCamId(null);
  };

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

  const totalPages = subscriberData ? Math.ceil(subscriberData.total / 50) : 1;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-on-surface">Email Newsletter</h1>
        <p className="mt-1 text-sm text-on-surface-variant">Quản lý người đăng ký và gửi chiến dịch email</p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-xl bg-surface-variant p-1 w-fit">
        {(['subscribers', 'campaigns'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
              activeTab === tab
                ? 'bg-white text-on-surface shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            {tab === 'subscribers' ? <Users size={15} /> : <FileText size={15} />}
            {tab === 'subscribers' ? 'Người đăng ký' : 'Chiến dịch'}
            {tab === 'subscribers' && subscriberData && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                {subscriberData.total}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ─── SUBSCRIBERS TAB ──────────────────────────────────────────────────── */}
      {activeTab === 'subscribers' && (
        <div className="rounded-xl border border-outline-variant bg-surface">
          <div className="flex items-center justify-between border-b border-outline-variant px-5 py-4">
            <div className="flex items-center gap-3">
              <select
                value={subStatus}
                onChange={(e) => { setSubStatus(e.target.value); setSubPage(1); }}
                className="rounded-lg border border-outline-variant bg-surface px-3 py-1.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">Tất cả trạng thái</option>
                <option value="active">Đang đăng ký</option>
                <option value="unsubscribed">Đã hủy</option>
              </select>
            </div>
            <p className="text-sm text-on-surface-variant">
              {subscriberData ? `${subscriberData.total} người đăng ký` : ''}
            </p>
          </div>

          {subLoading ? (
            <div className="flex justify-center py-12">
              <div className="h-7 w-7 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : (subscriberData?.items.length ?? 0) === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant">
              <Mail size={40} className="mb-3 opacity-30" />
              <p className="text-sm">Chưa có người đăng ký nào</p>
            </div>
          ) : (
            <>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-outline-variant text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                    <th className="px-5 py-3 text-left">Email</th>
                    <th className="px-5 py-3 text-left">Tên</th>
                    <th className="px-5 py-3 text-left">Trạng thái</th>
                    <th className="px-5 py-3 text-left">Ngày đăng ký</th>
                    <th className="px-5 py-3 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {subscriberData?.items.map((sub) => (
                    <tr key={sub.id} className="hover:bg-surface-variant/40 transition">
                      <td className="px-5 py-3 text-sm font-medium text-on-surface">{sub.email}</td>
                      <td className="px-5 py-3 text-sm text-on-surface-variant">{sub.name ?? '—'}</td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                            sub.status === 'active'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {sub.status === 'active' ? <CheckCircle2 size={11} /> : <X size={11} />}
                          {sub.status === 'active' ? 'Đang đăng ký' : 'Đã hủy'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm text-on-surface-variant">{formatDate(sub.createdAt)}</td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => void handleDeleteSubscriber(sub.id)}
                          disabled={deletingSubId === sub.id}
                          className="rounded-lg p-1.5 text-on-surface-variant transition hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-outline-variant px-5 py-3">
                  <p className="text-sm text-on-surface-variant">
                    Trang {subPage}/{totalPages}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSubPage((p) => Math.max(1, p - 1))}
                      disabled={subPage === 1}
                      className="rounded-lg border border-outline-variant px-3 py-1.5 text-sm disabled:opacity-40"
                    >
                      Trước
                    </button>
                    <button
                      onClick={() => setSubPage((p) => Math.min(totalPages, p + 1))}
                      disabled={subPage === totalPages}
                      className="rounded-lg border border-outline-variant px-3 py-1.5 text-sm disabled:opacity-40"
                    >
                      Tiếp
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ─── CAMPAIGNS TAB ──────────────────────────────────────────────────────── */}
      {activeTab === 'campaigns' && (
        <>
          <div className="mb-4 flex justify-end">
            <button
              onClick={() => openEditor()}
              className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white transition hover:bg-primary/90"
            >
              <Plus size={16} /> Tạo chiến dịch mới
            </button>
          </div>

          {campaignLoading ? (
            <div className="flex justify-center py-12">
              <div className="h-7 w-7 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : campaigns.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-outline-variant bg-surface py-16 text-on-surface-variant">
              <FileText size={40} className="mb-3 opacity-30" />
              <p className="text-sm">Chưa có chiến dịch nào. Tạo chiến dịch đầu tiên!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {campaigns.map((cam) => (
                <div
                  key={cam.id}
                  className="flex items-center gap-4 rounded-xl border border-outline-variant bg-surface px-5 py-4"
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                      cam.status === 'sent' ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'
                    }`}
                  >
                    {cam.status === 'sent' ? <CheckCircle2 size={18} /> : <Clock size={18} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-on-surface">{cam.subject}</p>
                    <p className="mt-0.5 text-xs text-on-surface-variant">
                      {cam.status === 'sent'
                        ? `Đã gửi ${cam.recipientCount} email · ${cam.sentAt ? formatDate(cam.sentAt) : ''}`
                        : `Bản nháp · ${formatDate(cam.createdAt)}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => setPreviewCampaign(cam)}
                      className="rounded-lg p-2 text-on-surface-variant transition hover:bg-surface-variant"
                      title="Xem trước"
                    >
                      <Eye size={15} />
                    </button>
                    {cam.status === 'draft' && (
                      <>
                        <button
                          onClick={() => openEditor(cam)}
                          className="rounded-lg p-2 text-on-surface-variant transition hover:bg-surface-variant"
                          title="Chỉnh sửa"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => void handleSendCampaign(cam.id, cam.subject)}
                          disabled={sendingId === cam.id}
                          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white transition hover:bg-primary/90 disabled:opacity-50"
                        >
                          {sendingId === cam.id ? (
                            <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          ) : (
                            <Send size={12} />
                          )}
                          Gửi
                        </button>
                        <button
                          onClick={() => void handleDeleteCampaign(cam.id)}
                          disabled={deletingCamId === cam.id}
                          className="rounded-lg p-2 text-on-surface-variant transition hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
                        >
                          <Trash2 size={15} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ─── CAMPAIGN EDITOR MODAL ──────────────────────────────────────────────── */}
      {showEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex w-full max-w-2xl flex-col rounded-2xl bg-surface shadow-2xl" style={{ maxHeight: '90vh' }}>
            <div className="flex items-center justify-between border-b border-outline-variant px-6 py-4">
              <h2 className="font-bold text-on-surface">
                {editingCampaign ? 'Chỉnh sửa chiến dịch' : 'Tạo chiến dịch mới'}
              </h2>
              <button onClick={() => setShowEditor(false)} className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-variant">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-on-surface">
                  Tiêu đề email (Subject) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formSubject}
                  onChange={(e) => setFormSubject(e.target.value)}
                  placeholder="VD: Khuyến mãi tháng 5 - Giảm 20% phân bón..."
                  className="w-full rounded-xl border border-outline-variant bg-surface px-4 py-2.5 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-on-surface">
                  Nội dung email (HTML) <span className="text-red-500">*</span>
                </label>
                <p className="mb-2 text-xs text-on-surface-variant">
                  Nhập nội dung HTML hoặc văn bản thuần. Hệ thống sẽ tự động bọc trong template email đẹp.
                </p>
                <textarea
                  value={formBody}
                  onChange={(e) => setFormBody(e.target.value)}
                  rows={10}
                  placeholder={'<h2>Chào bạn,</h2>\n<p>Chúng tôi có ưu đãi đặc biệt dành cho bạn...</p>\n<p><a href="https://...">Xem ngay →</a></p>'}
                  className="w-full rounded-xl border border-outline-variant bg-surface px-4 py-3 font-mono text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-outline-variant px-6 py-4">
              <button
                onClick={() => setShowEditor(false)}
                className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface hover:bg-surface-variant"
              >
                Hủy
              </button>
              <button
                onClick={() => void handleSaveCampaign()}
                disabled={formSaving || !formSubject.trim() || !formBody.trim()}
                className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-sm font-bold text-white transition hover:bg-primary/90 disabled:opacity-50"
              >
                {formSaving && <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                Lưu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── PREVIEW MODAL ──────────────────────────────────────────────────────── */}
      {previewCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex w-full max-w-2xl flex-col rounded-2xl bg-surface shadow-2xl" style={{ maxHeight: '90vh' }}>
            <div className="flex items-center justify-between border-b border-outline-variant px-6 py-4">
              <h2 className="font-bold text-on-surface">Xem trước: {previewCampaign.subject}</h2>
              <button onClick={() => setPreviewCampaign(null)} className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-variant">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-hidden p-4">
              <iframe
                ref={previewRef}
                title="Email preview"
                className="h-full w-full rounded-xl border border-outline-variant"
                style={{ minHeight: 400 }}
                sandbox="allow-same-origin"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
