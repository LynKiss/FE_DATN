import { useState, type FormEvent, type ChangeEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Leaf, LoaderCircle, AlertCircle, CheckCircle2 } from 'lucide-react';
import { registerClient, loginClient } from '../../lib/client-api';
import { refreshGlobalCart } from '../../hooks/useCart';

export default function ClientRegister() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    phoneNumber: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const setField = (key: keyof typeof form) => (e: ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }
    if (form.password.length < 6) {
      setError('Mật khẩu tối thiểu 6 ký tự.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await registerClient({
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
        fullName: form.fullName.trim() || undefined,
        phoneNumber: form.phoneNumber.trim() || undefined,
      });
      // Auto login after register
      await loginClient(form.username.trim(), form.password);
      await refreshGlobalCart();
      setSuccess(true);
      setTimeout(() => void navigate('/client'), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đăng ký thất bại. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="client-surface flex min-h-screen items-center justify-center px-4">
        <div className="text-center">
          <CheckCircle2 size={56} className="mx-auto mb-4 text-[#006241]" />
          <h2 className="text-2xl font-black text-[#1E3932]">Đăng ký thành công!</h2>
          <p className="mt-2 text-sm text-gray-500">Chào mừng bạn đến với Cultivated Ledger 🌿</p>
        </div>
      </div>
    );
  }

  return (
    <div className="client-surface flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link to="/client" className="inline-flex flex-col items-center gap-3">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full"
              style={{ background: '#1E3932' }}
            >
              <Leaf size={26} className="text-white" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.3em]" style={{ color: '#006241' }}>
                Cultivated Ledger
              </p>
              <p className="text-lg font-black" style={{ color: '#1E3932' }}>Tạo tài khoản</p>
            </div>
          </Link>
        </div>

        <div className="client-card p-8">
          {error && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-red-50 p-3.5 text-sm text-red-700">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#1E3932]">
                  Họ và tên
                </label>
                <input
                  value={form.fullName}
                  onChange={setField('fullName')}
                  placeholder="Nguyễn Văn A"
                  className="client-input w-full px-4 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#1E3932]">
                  Tên đăng nhập *
                </label>
                <input
                  value={form.username}
                  onChange={setField('username')}
                  placeholder="user123"
                  required
                  autoComplete="username"
                  className="client-input w-full px-4 py-2.5 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#1E3932]">
                Email *
              </label>
              <input
                type="email"
                value={form.email}
                onChange={setField('email')}
                placeholder="email@example.com"
                required
                autoComplete="email"
                className="client-input w-full px-4 py-2.5 text-sm"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#1E3932]">
                Số điện thoại
              </label>
              <input
                type="tel"
                value={form.phoneNumber}
                onChange={setField('phoneNumber')}
                placeholder="0901234567"
                autoComplete="tel"
                className="client-input w-full px-4 py-2.5 text-sm"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#1E3932]">
                Mật khẩu * (tối thiểu 6 ký tự)
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={setField('password')}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  className="client-input w-full px-4 py-2.5 pr-12 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#1E3932]">
                Xác nhận mật khẩu *
              </label>
              <input
                type="password"
                value={form.confirmPassword}
                onChange={setField('confirmPassword')}
                placeholder="••••••••"
                required
                autoComplete="new-password"
                className="client-input w-full px-4 py-2.5 text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="client-pill-primary flex w-full items-center justify-center gap-2 py-3.5 text-sm font-bold disabled:opacity-60"
            >
              {loading && <LoaderCircle size={16} className="animate-spin" />}
              {loading ? 'Đang tạo tài khoản...' : 'Tạo tài khoản'}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-gray-400">
            Bằng cách đăng ký, bạn đồng ý với{' '}
            <a href="#" className="text-[#006241]">Điều khoản dịch vụ</a>
            {' '}và{' '}
            <a href="#" className="text-[#006241]">Chính sách bảo mật</a>.
          </p>

          <div className="mt-5 text-center text-sm text-gray-500">
            Đã có tài khoản?{' '}
            <Link to="/client/login" className="font-bold text-[#006241] hover:underline">
              Đăng nhập
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
