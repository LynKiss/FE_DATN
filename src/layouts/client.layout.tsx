import { Outlet, NavLink, Link, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef, type FormEvent } from 'react';
import {
  ShoppingCart,
  Search,
  User,
  LogOut,
  Package,
  ChevronDown,
  Menu,
  X,
  Leaf,
  Phone,
  Mail,
  MapPin,
  Facebook,
  Youtube,
  Heart,
} from 'lucide-react';
import { useClientSession } from '../hooks/useClientSession';
import { useCart } from '../hooks/useCart';
import { logoutClient, clientApi } from '../lib/client-api';
import { lazy, Suspense } from 'react';

const Chatbox = lazy(() => import('../components/client/Chatbox'));

type SearchProduct = {
  productId: string;
  productName: string;
  productPrice: string;
  effectivePrice: string;
  primaryImageUrl: string | null;
};

export default function ClientLayout() {
  const { session } = useClientSession();
  const { cart } = useCart();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SearchProduct[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  // Search autocomplete debounce
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const timer = setTimeout(() => {
      void clientApi
        .get<{ meta: unknown; items: SearchProduct[] }>(`/products?search=${encodeURIComponent(searchQuery)}&limit=6`)
        .then((data) => {
          setSuggestions(data.items ?? []);
          setShowSuggestions(true);
        })
        .catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setSearchOpen(false);
      setShowSuggestions(false);
      void navigate(`/client/products?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
    }
  };

  const handleSuggestionClick = (productId: string) => {
    setSearchOpen(false);
    setShowSuggestions(false);
    setSearchQuery('');
    void navigate(`/client/products/${productId}`);
  };

  const handleLogout = async () => {
    await logoutClient();
    setUserMenuOpen(false);
    void navigate('/client');
  };

  const cartCount = cart?.totalItems ?? 0;
  const displayName = session?.user.fullName || session?.user.username || '';

  const navLinks = [
    { to: '/client', label: 'Trang chủ', end: true },
    { to: '/client/products', label: 'Sản phẩm' },
    { to: '/client/news', label: 'Tin tức' },
  ];

  return (
    <div className="flex min-h-screen flex-col" style={{ background: '#f2f0eb' }}>
      {/* Top bar */}
      <div style={{ background: '#1E3932' }} className="hidden text-white/70 lg:block">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-2 text-xs">
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1.5">
              <Phone size={11} />
              1800 6863
            </span>
            <span className="flex items-center gap-1.5">
              <Mail size={11} />
              support@cultivatedledger.vn
            </span>
          </div>
          <span className="flex items-center gap-1.5">
            <MapPin size={11} />
            Giao hàng toàn quốc — miễn phí đơn từ 500.000đ
          </span>
        </div>
      </div>

      {/* Main navbar */}
      <header
        className={`sticky top-0 z-50 transition-shadow duration-300 ${
          scrolled ? 'shadow-[0_4px_24px_rgba(0,0,0,0.12)]' : ''
        }`}
        style={{ background: 'rgba(242,240,235,0.95)', backdropFilter: 'blur(16px)' }}
      >
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 lg:px-6 lg:py-4">
          {/* Logo */}
          <Link to="/client" className="flex shrink-0 items-center gap-2.5">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full"
              style={{ background: '#006241' }}
            >
              <Leaf size={18} className="text-white" />
            </div>
            <div className="hidden sm:block">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em]" style={{ color: '#006241' }}>
                Cultivated Ledger
              </p>
              <p className="text-xs font-black leading-none" style={{ color: '#1E3932' }}>
                Vật Tư Nông Nghiệp
              </p>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden flex-1 items-center justify-center gap-1 lg:flex">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  `rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                    isActive
                      ? 'bg-[#006241] text-white'
                      : 'text-[#1E3932] hover:bg-[#006241]/10'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
            <NavLink
              to="/client/products?category=khuyen-mai"
              className="rounded-full px-4 py-2 text-sm font-semibold text-[#c82014] transition-all hover:bg-[#c82014]/10"
            >
              🔥 Khuyến mãi
            </NavLink>
          </nav>

          {/* Actions */}
          <div className="ml-auto flex items-center gap-1 lg:gap-2">
            {/* Search with autocomplete */}
            {searchOpen ? (
              <div ref={searchContainerRef} className="relative">
                <form
                  onSubmit={handleSearch}
                  className="flex items-center rounded-full border border-[#006241]/30 bg-white px-4 py-2"
                >
                  <input
                    ref={searchRef}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                    placeholder="Tìm sản phẩm..."
                    className="w-48 bg-transparent text-sm outline-none"
                  />
                  <button type="submit" className="ml-2 text-[#006241]">
                    <Search size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSearchOpen(false); setShowSuggestions(false); setSearchQuery(''); }}
                    className="ml-1 text-gray-400"
                  >
                    <X size={14} />
                  </button>
                </form>

                {/* Suggestions dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute left-0 top-full mt-2 w-72 overflow-hidden rounded-2xl border border-black/8 bg-white shadow-xl">
                    {suggestions.map((p) => (
                      <button
                        key={p.productId}
                        type="button"
                        onClick={() => handleSuggestionClick(p.productId)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-[#006241]/5"
                      >
                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-[#f2f0eb]">
                          {p.primaryImageUrl ? (
                            <img src={p.primaryImageUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full items-center justify-center">
                              <Leaf size={14} className="text-[#006241]/40" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-1 text-xs font-semibold text-[#1E3932]">{p.productName}</p>
                          <p className="text-xs font-bold text-[#006241]">
                            {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(
                              Number(p.effectivePrice),
                            )}
                          </p>
                        </div>
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setShowSuggestions(false);
                        void navigate(`/client/products?search=${encodeURIComponent(searchQuery)}`);
                        setSearchOpen(false);
                        setSearchQuery('');
                      }}
                      className="flex w-full items-center justify-center gap-1.5 border-t border-black/5 py-2.5 text-xs font-semibold text-[#006241] hover:bg-[#006241]/5"
                    >
                      <Search size={12} /> Xem tất cả kết quả
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => setSearchOpen(true)}
                className="flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-[#006241]/10"
                style={{ color: '#1E3932' }}
              >
                <Search size={18} />
              </button>
            )}

            {/* Wishlist */}
            {session && (
              <Link
                to="/client/wishlist"
                className="relative flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-[#006241]/10"
                style={{ color: '#1E3932' }}
              >
                <Heart size={18} />
              </Link>
            )}

            {/* Cart */}
            <Link
              to="/client/cart"
              className="relative flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-[#006241]/10"
              style={{ color: '#1E3932' }}
            >
              <ShoppingCart size={18} />
              {cartCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#c82014] px-1 text-[9px] font-black text-white">
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </Link>

            {/* User menu */}
            {session ? (
              <div ref={userMenuRef} className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 rounded-full px-3 py-1.5 transition hover:bg-[#006241]/10"
                >
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ background: '#006241' }}
                  >
                    {(displayName[0] ?? 'U').toUpperCase()}
                  </div>
                  <span className="hidden text-sm font-semibold text-[#1E3932] lg:block">
                    {displayName}
                  </span>
                  <ChevronDown
                    size={14}
                    className={`text-[#1E3932] transition-transform ${userMenuOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-52 overflow-hidden rounded-2xl border border-black/8 bg-white shadow-xl">
                    <div className="border-b border-black/5 px-4 py-3">
                      <p className="text-sm font-bold text-[#1E3932]">{displayName}</p>
                      <p className="truncate text-xs text-gray-400">{session.user.email}</p>
                    </div>
                    <div className="p-1">
                      <Link
                        to="/client/account"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[#1E3932] transition hover:bg-[#006241]/8"
                      >
                        <User size={15} /> Tài khoản của tôi
                      </Link>
                      <Link
                        to="/client/orders"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[#1E3932] transition hover:bg-[#006241]/8"
                      >
                        <Package size={15} /> Đơn hàng
                      </Link>
                      <Link
                        to="/client/wishlist"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[#1E3932] transition hover:bg-[#006241]/8"
                      >
                        <Heart size={15} /> Yêu thích
                      </Link>
                      <button
                        onClick={() => void handleLogout()}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-red-600 transition hover:bg-red-50"
                      >
                        <LogOut size={15} /> Đăng xuất
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link
                to="/client/login"
                className="hidden rounded-full px-5 py-2 text-sm font-bold text-white transition active:scale-95 lg:flex"
                style={{ background: '#00754A' }}
              >
                Đăng nhập
              </Link>
            )}

            {/* Mobile menu */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-[#006241]/10 lg:hidden"
              style={{ color: '#1E3932' }}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        {mobileOpen && (
          <div className="border-t border-black/8 bg-white px-4 pb-4 pt-2 lg:hidden">
            <nav className="flex flex-col gap-1">
              {navLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.end}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                      isActive ? 'bg-[#006241] text-white' : 'text-[#1E3932]'
                    }`
                  }
                >
                  {link.label}
                </NavLink>
              ))}
              {!session ? (
                <div className="mt-2 flex gap-2 pt-2 border-t border-black/5">
                  <Link
                    to="/client/login"
                    onClick={() => setMobileOpen(false)}
                    className="flex-1 rounded-full py-2.5 text-center text-sm font-bold text-white"
                    style={{ background: '#00754A' }}
                  >
                    Đăng nhập
                  </Link>
                  <Link
                    to="/client/register"
                    onClick={() => setMobileOpen(false)}
                    className="flex-1 rounded-full py-2.5 text-center text-sm font-bold border border-[#006241] text-[#006241]"
                  >
                    Đăng ký
                  </Link>
                </div>
              ) : null}
            </nav>
          </div>
        )}
      </header>

      {/* Page content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer style={{ background: '#1E3932' }} className="text-white">
        <div className="mx-auto max-w-7xl px-6 py-14">
          <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
            {/* Brand */}
            <div className="lg:col-span-1">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: '#00754A' }}>
                  <Leaf size={20} className="text-white" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/50">
                    Cultivated Ledger
                  </p>
                  <p className="text-sm font-black text-white">Vật Tư Nông Nghiệp</p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-white/60">
                Cung cấp vật tư nông nghiệp chất lượng cao cho nông dân Việt Nam. Cam kết uy tín
                — giá tốt — giao nhanh.
              </p>
              <div className="mt-5 flex gap-3">
                <a href="#" className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-white/60 transition hover:border-white/30 hover:text-white">
                  <Facebook size={16} />
                </a>
                <a href="#" className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-white/60 transition hover:border-white/30 hover:text-white">
                  <Youtube size={16} />
                </a>
              </div>
            </div>

            {/* Products */}
            <div>
              <h3 className="mb-4 text-sm font-black uppercase tracking-[0.2em] text-white/40">
                Sản phẩm
              </h3>
              <ul className="space-y-3 text-sm text-white/60">
                {['Phân bón hữu cơ', 'Thuốc bảo vệ thực vật', 'Hạt giống', 'Dụng cụ nông nghiệp', 'Nhà màng – Tưới tiêu'].map(
                  (item) => (
                    <li key={item}>
                      <Link to="/client/products" className="transition hover:text-white">
                        {item}
                      </Link>
                    </li>
                  ),
                )}
              </ul>
            </div>

            {/* Support */}
            <div>
              <h3 className="mb-4 text-sm font-black uppercase tracking-[0.2em] text-white/40">
                Hỗ trợ
              </h3>
              <ul className="space-y-3 text-sm text-white/60">
                {['Hướng dẫn mua hàng', 'Chính sách đổi trả', 'Chính sách bảo hành', 'Tin tức – Kiến thức', 'Liên hệ chúng tôi'].map(
                  (item) => (
                    <li key={item}>
                      <a href="#" className="transition hover:text-white">
                        {item}
                      </a>
                    </li>
                  ),
                )}
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h3 className="mb-4 text-sm font-black uppercase tracking-[0.2em] text-white/40">
                Liên hệ
              </h3>
              <ul className="space-y-3 text-sm text-white/60">
                <li className="flex items-start gap-2.5">
                  <Phone size={14} className="mt-0.5 shrink-0" />
                  <span>1800 6863 (miễn phí)</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Mail size={14} className="mt-0.5 shrink-0" />
                  <span>support@cultivatedledger.vn</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <MapPin size={14} className="mt-0.5 shrink-0" />
                  <span>123 Đường Nông Nghiệp, Quận 12, TP.HCM</span>
                </li>
              </ul>
              <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-3 text-center">
                <p className="text-[11px] text-white/40">Mở cửa</p>
                <p className="text-sm font-bold text-white">7:00 – 21:00 mỗi ngày</p>
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-white/8 pt-8 text-xs text-white/30 sm:flex-row">
            <p>© 2025 Cultivated Ledger. Bảo lưu mọi quyền.</p>
            <div className="flex gap-6">
              <a href="#" className="transition hover:text-white/60">Chính sách bảo mật</a>
              <a href="#" className="transition hover:text-white/60">Điều khoản sử dụng</a>
            </div>
          </div>
        </div>
      </footer>

      {/* Chatbox */}
      <Suspense fallback={null}>
        <Chatbox />
      </Suspense>
    </div>
  );
}
