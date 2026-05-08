import { FormEvent, useEffect, useState } from 'react';
import { Eye, EyeOff, LockKeyhole, Shield, Workflow } from 'lucide-react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useSuperAdminSession } from '../hooks/useSuperAdminSession';
import { getSuperAdminApiBaseUrl, loginSuperAdmin } from '../lib/super-admin-api';

const heroImage =
  'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80';

export default function SuperAdminLogin() {
  const { session } = useSuperAdminSession();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const from = (location.state as { from?: string } | null)?.from ?? '/admin/super-admin';

  useEffect(() => {
    setError(null);
  }, [email, password]);

  if (session) {
    return <Navigate to={from} replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await loginSuperAdmin(email, password);
      navigate(from, { replace: true });
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Super admin login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-[#eef2f0] text-[#13251f] lg:grid-cols-[1fr_480px]">
      <section className="relative hidden overflow-hidden lg:block">
        <img src={heroImage} alt="Security operations" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(9,24,20,0.82),rgba(9,24,20,0.32))]" />
        <div className="relative z-10 flex h-full flex-col justify-end p-12 text-white">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] backdrop-blur">
            <Workflow size={15} />
            Multi-project control
          </div>
          <h1 className="mt-5 max-w-2xl text-5xl font-black leading-none">
            Super Admin Authority
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-white/72">
            Central permission console for protected project administration.
          </p>
        </div>
      </section>

      <section className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-[390px]">
          <div className="flex h-13 w-13 items-center justify-center rounded-2xl bg-[#09251d] text-white">
            <Shield size={24} />
          </div>
          <h2 className="mt-5 text-3xl font-black tracking-tight">Super admin login</h2>
          <p className="mt-2 text-sm leading-6 text-[#5f6f68]">
            API base: <span className="font-semibold">{getSuperAdminApiBaseUrl()}</span>
          </p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            <label className="block">
              <span className="text-[11px] font-black uppercase tracking-[0.18em] text-[#61726b]">
                Email
              </span>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 h-12 w-full rounded-xl border border-[#d8e0dc] bg-white px-4 text-sm outline-none transition focus:border-[#0b7a58]"
                placeholder="root@example.com"
              />
            </label>

            <label className="block">
              <span className="text-[11px] font-black uppercase tracking-[0.18em] text-[#61726b]">
                Password
              </span>
              <div className="relative mt-2">
                <LockKeyhole className="absolute left-4 top-1/2 -translate-y-1/2 text-[#74847d]" size={16} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-12 w-full rounded-xl border border-[#d8e0dc] bg-white pl-11 pr-12 text-sm outline-none transition focus:border-[#0b7a58]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#74847d] hover:text-[#13251f]"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="h-12 w-full rounded-xl bg-[#09251d] text-sm font-black text-white transition hover:bg-[#103a2f] disabled:opacity-60"
            >
              {loading ? 'Signing in...' : 'Enter super console'}
            </button>
          </form>

          {error ? <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
        </div>
      </section>
    </main>
  );
}
