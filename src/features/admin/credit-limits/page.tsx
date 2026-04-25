import { useEffect, useState, useCallback } from 'react';
import { CreditCard, Plus, RefreshCw, X, Trash2, AlertCircle } from 'lucide-react';
import { apiClient } from '../../../lib/api';

interface CreditLimitItem {
  limitId: string;
  userId: string;
  username: string | null;
  email: string | null;
  fullName: string | null;
  creditLimit: string;
  currentDebt: string;
  availableCredit: number;
  notes: string | null;
  updatedAt: string;
}

interface User {
  userId: string;
  username: string;
  email: string;
  fullName: string | null;
}

export default function CreditLimitsPage() {
  const [items, setItems] = useState<CreditLimitItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState({ userId: '', creditLimit: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await apiClient.get<{ items: CreditLimitItem[]; meta: { total: number } }>('/credit-limits?limit=50');
      setItems(d.items ?? []);
      setTotal(d.meta?.total ?? 0);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    void apiClient.get<{ items: User[] }>('/users?limit=100').then((d) => setUsers(d.items ?? []));
  }, [load]);

  const fmt = (n: number) => n.toLocaleString('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });

  const handleSave = async () => {
    if (!form.userId || !form.creditLimit) return;
    setSaving(true);
    try {
      await apiClient.post('/credit-limits', {
        userId: form.userId,
        creditLimit: Number(form.creditLimit),
        notes: form.notes || undefined,
      });
      setShowModal(false);
      setForm({ userId: '', creditLimit: '', notes: '' });
      void load();
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async (userId: string) => {
    setSyncingId(userId);
    try {
      await apiClient.post(`/credit-limits/sync-debt/${userId}`, {});
      void load();
    } finally {
      setSyncingId(null);
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm('Xóa hạn mức cho người dùng này?')) return;
    await apiClient.delete(`/credit-limits/user/${userId}`);
    void load();
  };

  const usagePercent = (item: CreditLimitItem) => {
    const limit = Number(item.creditLimit);
    if (limit <= 0) return 0;
    return Math.min(100, (Number(item.currentDebt) / limit) * 100);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <CreditCard className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-bold text-on-surface">Hạn Mức Công Nợ Khách Sỉ</h1>
        <span className="text-sm text-on-surface-variant ml-2">{total} khách</span>
        <div className="ml-auto flex gap-2">
          <button onClick={load} className="flex items-center gap-1.5 rounded-lg border border-outline-variant px-3 py-1.5 text-sm hover:bg-surface-variant">
            <RefreshCw className="h-3.5 w-3.5" /> Làm mới
          </button>
          <button onClick={() => setShowModal(true)} className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm text-white hover:bg-primary/90">
            <Plus className="h-3.5 w-3.5" /> Thêm hạn mức
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 flex items-start gap-2 text-sm text-blue-700">
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
        <span>Hạn mức tín dụng giới hạn tổng công nợ (đơn hàng chưa thanh toán) của khách sỉ. Nhấn "Đồng bộ nợ" để cập nhật số nợ thực tế từ đơn hàng.</span>
      </div>

      {loading ? (
        <div className="py-10 text-center text-on-surface-variant">Đang tải...</div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-outline-variant bg-surface py-16 text-center text-on-surface-variant">
          <CreditCard className="mx-auto mb-3 h-10 w-10 opacity-30" />
          <p>Chưa có hạn mức nào. Nhấn "Thêm hạn mức" để bắt đầu.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const pct = usagePercent(item);
            const barColor = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-green-500';
            return (
              <div key={item.limitId} className="rounded-xl border border-outline-variant bg-surface p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-on-surface">{item.fullName ?? item.username ?? item.email}</p>
                    <p className="text-xs text-on-surface-variant">{item.email}</p>
                  </div>
                  <button onClick={() => void handleDelete(item.userId)} className="rounded p-1 text-red-400 hover:bg-red-50">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-on-surface-variant">
                    <span>Sử dụng: {fmt(Number(item.currentDebt))}</span>
                    <span>{pct.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-surface-variant overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-on-surface-variant">Hạn mức: <strong>{fmt(Number(item.creditLimit))}</strong></span>
                    <span className={`font-semibold ${item.availableCredit <= 0 ? 'text-red-600' : 'text-green-600'}`}>
                      Còn: {fmt(item.availableCredit)}
                    </span>
                  </div>
                </div>

                {item.notes && <p className="text-xs text-on-surface-variant italic">{item.notes}</p>}

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => void handleSync(item.userId)}
                    disabled={syncingId === item.userId}
                    className="flex-1 rounded-lg border border-outline-variant px-2 py-1.5 text-xs hover:bg-surface-variant disabled:opacity-60"
                  >
                    {syncingId === item.userId ? 'Đang đồng bộ...' : 'Đồng bộ nợ'}
                  </button>
                  <button
                    onClick={() => { setForm({ userId: item.userId, creditLimit: item.creditLimit, notes: item.notes ?? '' }); setShowModal(true); }}
                    className="flex-1 rounded-lg bg-primary/10 px-2 py-1.5 text-xs text-primary hover:bg-primary/20"
                  >
                    Chỉnh hạn mức
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-on-surface">Cài hạn mức tín dụng</h3>
              <button onClick={() => { setShowModal(false); setForm({ userId: '', creditLimit: '', notes: '' }); }} className="rounded-lg p-1.5 hover:bg-surface-variant">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-on-surface">Khách hàng</label>
                <select
                  className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm focus:ring-2 focus:ring-primary"
                  value={form.userId}
                  onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))}
                >
                  <option value="">-- Chọn khách hàng --</option>
                  {users.map((u) => (
                    <option key={u.userId} value={u.userId}>
                      {u.fullName ?? u.username} ({u.email})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-on-surface">Hạn mức tín dụng (₫)</label>
                <input
                  type="number" min="0"
                  className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm focus:ring-2 focus:ring-primary"
                  placeholder="ví dụ: 10000000"
                  value={form.creditLimit}
                  onChange={(e) => setForm((f) => ({ ...f, creditLimit: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-on-surface">Ghi chú</label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
                  placeholder="Tùy chọn"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => { setShowModal(false); setForm({ userId: '', creditLimit: '', notes: '' }); }} className="rounded-lg border border-outline-variant px-4 py-2 text-sm hover:bg-surface-variant">Hủy</button>
                <button onClick={() => void handleSave()} disabled={saving || !form.userId || !form.creditLimit} className="rounded-lg bg-primary px-4 py-2 text-sm text-white hover:bg-primary/90 disabled:opacity-60">
                  {saving ? 'Đang lưu...' : 'Lưu'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
