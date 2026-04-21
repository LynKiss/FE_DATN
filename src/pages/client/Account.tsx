import { useState, useEffect, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, KeyRound, MapPin, Package, LogOut, Save, LoaderCircle, CheckCircle2, AlertCircle, Heart } from 'lucide-react';
import { clientApi, logoutClient } from '../../lib/client-api';
import { useClientSession } from '../../hooks/useClientSession';

type Profile = {
  _id: string;
  username: string;
  email: string;
  fullName?: string;
  phoneNumber?: string;
  avatar?: string;
};

export default function Account() {
  const navigate = useNavigate();
  const { session } = useClientSession();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'password'>('profile');

  const [form, setForm] = useState({ fullName: '', phoneNumber: '' });
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });

  useEffect(() => {
    if (!session) { void navigate('/client/login'); return; }
    void clientApi
      .get<Profile>('/users/me')
      .then((data) => {
        setProfile(data);
        setForm({ fullName: data.fullName ?? '', phoneNumber: data.phoneNumber ?? '' });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session, navigate]);

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await clientApi.patch('/users/me', form);
      showToast('success', 'Cập nhật hồ sơ thành công');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Cập nhật thất bại');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (passwords.next !== passwords.confirm) {
      showToast('error', 'Mật khẩu mới không khớp');
      return;
    }
    if (passwords.next.length < 6) {
      showToast('error', 'Mật khẩu tối thiểu 6 ký tự');
      return;
    }
    setSaving(true);
    try {
      await clientApi.patch('/users/me/change-password', {
        currentPassword: passwords.current,
        newPassword: passwords.next,
      });
      setPasswords({ current: '', next: '', confirm: '' });
      showToast('success', 'Đổi mật khẩu thành công');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Đổi mật khẩu thất bại');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logoutClient();
    void navigate('/client');
  };

  if (loading) {
    return (
      <div style={{ background: '#f2f0eb', minHeight: '60vh' }} className="flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#006241] border-t-transparent" />
      </div>
    );
  }

  const initials = (profile?.fullName ?? profile?.username ?? 'U').slice(0, 2).toUpperCase();

  return (
    <div style={{ background: '#f2f0eb', minHeight: '80vh' }}>
      <div className="mx-auto max-w-5xl px-4 py-10 lg:px-6">
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.25em]" style={{ color: '#006241' }}>
            Cá nhân
          </p>
          <h1 className="mt-1 text-3xl font-black text-[#1E3932]">Tài khoản của tôi</h1>
        </div>

        {/* Toast */}
        {toast && (
          <div
            className={`mb-4 flex items-center gap-2.5 rounded-xl p-3.5 text-sm ${
              toast.type === 'success'
                ? 'bg-[#d4e9e2] text-[#1E3932]'
                : 'bg-red-50 text-red-700'
            }`}
          >
            {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            {toast.msg}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
          {/* Sidebar */}
          <div className="space-y-3">
            {/* Avatar card */}
            <div className="rounded-2xl bg-white p-5 text-center shadow-sm">
              <div
                className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full text-xl font-black text-white"
                style={{ background: '#1E3932' }}
              >
                {initials}
              </div>
              <p className="font-bold text-[#1E3932]">
                {profile?.fullName ?? profile?.username}
              </p>
              <p className="text-xs text-gray-400">{profile?.email}</p>
            </div>

            {/* Nav */}
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
              {[
                { id: 'profile', label: 'Thông tin cá nhân', icon: User },
                { id: 'password', label: 'Đổi mật khẩu', icon: KeyRound },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as 'profile' | 'password')}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-sm font-semibold transition ${
                    activeTab === item.id
                      ? 'bg-[#006241]/10 text-[#006241]'
                      : 'text-[#1E3932] hover:bg-black/3'
                  }`}
                >
                  <item.icon size={15} />
                  {item.label}
                </button>
              ))}
              <Link
                to="/client/orders"
                className="flex w-full items-center gap-3 px-4 py-3 text-sm font-semibold text-[#1E3932] transition hover:bg-black/3"
              >
                <Package size={15} /> Lịch sử đơn hàng
              </Link>
              <Link
                to="/client/wishlist"
                className="flex w-full items-center gap-3 px-4 py-3 text-sm font-semibold text-[#1E3932] transition hover:bg-black/3"
              >
                <Heart size={15} /> Sản phẩm yêu thích
              </Link>
              <Link
                to="/client/account/addresses"
                className="flex w-full items-center gap-3 px-4 py-3 text-sm font-semibold text-[#1E3932] transition hover:bg-black/3"
              >
                <MapPin size={15} /> Địa chỉ giao hàng
              </Link>
              <button
                onClick={() => void handleLogout()}
                className="flex w-full items-center gap-3 border-t border-black/5 px-4 py-3 text-sm font-semibold text-red-500 transition hover:bg-red-50"
              >
                <LogOut size={15} /> Đăng xuất
              </button>
            </div>
          </div>

          {/* Main panel */}
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            {activeTab === 'profile' ? (
              <>
                <h2 className="mb-5 text-lg font-black text-[#1E3932]">Thông tin cá nhân</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-gray-500">
                      Họ và tên
                    </label>
                    <input
                      value={form.fullName}
                      onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                      placeholder="Nguyễn Văn A"
                      className="w-full rounded-xl border border-black/10 bg-[#f2f0eb] px-4 py-2.5 text-sm outline-none focus:border-[#006241]"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-gray-500">
                      Tên đăng nhập
                    </label>
                    <input
                      value={profile?.username ?? ''}
                      disabled
                      className="w-full rounded-xl border border-black/5 bg-gray-50 px-4 py-2.5 text-sm text-gray-400"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-gray-500">Email</label>
                    <input
                      value={profile?.email ?? ''}
                      disabled
                      className="w-full rounded-xl border border-black/5 bg-gray-50 px-4 py-2.5 text-sm text-gray-400"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-gray-500">
                      Số điện thoại
                    </label>
                    <input
                      value={form.phoneNumber}
                      onChange={(e) => setForm((f) => ({ ...f, phoneNumber: e.target.value }))}
                      placeholder="0901234567"
                      className="w-full rounded-xl border border-black/10 bg-[#f2f0eb] px-4 py-2.5 text-sm outline-none focus:border-[#006241]"
                    />
                  </div>
                </div>
                <button
                  onClick={() => void handleSaveProfile()}
                  disabled={saving}
                  className="mt-6 flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-white disabled:opacity-60 active:scale-95"
                  style={{ background: '#00754A' }}
                >
                  {saving ? <LoaderCircle size={15} className="animate-spin" /> : <Save size={15} />}
                  {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </>
            ) : (
              <>
                <h2 className="mb-5 text-lg font-black text-[#1E3932]">Đổi mật khẩu</h2>
                <form onSubmit={(e) => void handleChangePassword(e)} className="max-w-sm space-y-4">
                  {[
                    { key: 'current', label: 'Mật khẩu hiện tại' },
                    { key: 'next', label: 'Mật khẩu mới' },
                    { key: 'confirm', label: 'Xác nhận mật khẩu mới' },
                  ].map((field) => (
                    <div key={field.key}>
                      <label className="mb-1.5 block text-xs font-semibold text-gray-500">
                        {field.label}
                      </label>
                      <input
                        type="password"
                        value={passwords[field.key as keyof typeof passwords]}
                        onChange={(e) =>
                          setPasswords((p) => ({ ...p, [field.key]: e.target.value }))
                        }
                        required
                        className="w-full rounded-xl border border-black/10 bg-[#f2f0eb] px-4 py-2.5 text-sm outline-none focus:border-[#006241]"
                      />
                    </div>
                  ))}
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-white disabled:opacity-60 active:scale-95"
                    style={{ background: '#00754A' }}
                  >
                    {saving ? <LoaderCircle size={15} className="animate-spin" /> : <KeyRound size={15} />}
                    {saving ? 'Đang cập nhật...' : 'Đổi mật khẩu'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
