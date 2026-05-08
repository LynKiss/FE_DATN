import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, Leaf, LoaderCircle, AlertCircle } from 'lucide-react';
import { loginClient } from '../../lib/client-api';
import { useClientSession } from '../../hooks/useClientSession';
import { refreshGlobalCart } from '../../hooks/useCart';
import { useEffect } from 'react';

export default function ClientLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session } = useClientSession();
  const from = (location.state as { from?: string } | null)?.from ?? '/client';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (session) void navigate(from, { replace: true });
  }, [session, navigate, from]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setLoading(true);
    setError('');
    try {
      await loginClient(username.trim(), password);
      await refreshGlobalCart();
      void navigate(from, { replace: true });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="client-surface flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
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
              <p className="text-lg font-black" style={{ color: '#1E3932' }}>
                Đăng nhập
              </p>
            </div>
          </Link>
        </div>

        {/* Form card */}
        <div className="client-card p-8">
          {error && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-red-50 p-3.5 text-sm text-red-700">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-[#1E3932]">
                Tên đăng nhập hoặc Email
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Nhập tên đăng nhập hoặc email..."
                required
                autoComplete="username"
                className="client-input w-full px-4 py-3 text-sm"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-[#1E3932]">
                Mật khẩu
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu..."
                  required
                  autoComplete="current-password"
                  className="client-input w-full px-4 py-3 pr-12 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="client-pill-primary flex w-full items-center justify-center gap-2 py-3.5 text-sm font-bold disabled:opacity-60"
            >
              {loading && <LoaderCircle size={16} className="animate-spin" />}
              {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-500">
            Chưa có tài khoản?{' '}
            <Link
              to="/client/register"
              className="font-bold transition hover:underline"
              style={{ color: '#006241' }}
            >
              Đăng ký ngay
            </Link>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-gray-400">
          Là nhân viên/quản trị?{' '}
          <Link to="/login" className="text-[#006241] hover:underline">
            Đăng nhập trang quản trị
          </Link>
        </p>
      </div>
    </div>
  );
}
