import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  ChevronDown,
  Globe,
  LoaderCircle,
  LogOut,
  Menu,
  MoonStar,
  Search,
  Settings,
  ShieldCheck,
  SunMedium,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAdminSession } from '../hooks/useAdminSession';
import { useToast } from '../hooks/useToast';
import { apiClient, logoutAdmin } from '../lib/api';
import { useLanguage } from '../i18n/language-context';
import { useTheme } from '../theme/theme-context';

type NotifItem = {
  id: string | null;
  title: string;
  message: string;
  metadata: Record<string, unknown> | null;
  createdAt: string | null;
  channel: string;
};

type TopbarProps = {
  onOpenSidebar: () => void;
};

type AdminSearchItem = {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  badge: string;
  path: string;
};

type AdminSearchGroup = {
  key: string;
  label: string;
  items: AdminSearchItem[];
};

type AdminSearchResponse = {
  query: string;
  total: number;
  groups: AdminSearchGroup[];
};

export default function Topbar({ onOpenSidebar }: TopbarProps) {
  const navigate = useNavigate();
  const { session } = useAdminSession();
  const { showToast } = useToast();
  const { language, setLanguage } = useLanguage();
  const { themeMode, resolvedTheme, toggleTheme } = useTheme();
  const [loggingOut, setLoggingOut] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotifItem[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchGroups, setSearchGroups] = useState<AdminSearchGroup[]>([]);
  const [searchError, setSearchError] = useState('');
  const [selectedSearchIndex, setSelectedSearchIndex] = useState(0);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const isVietnamese = language === 'vi';

  const initials = useMemo(
    () =>
      (session?.user.username || 'Admin')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join(''),
    [session?.user.username],
  );

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!accountMenuRef.current?.contains(event.target as Node)) {
        setAccountMenuOpen(false);
      }
      if (!notifRef.current?.contains(event.target as Node)) {
        setNotifOpen(false);
      }
      if (!searchContainerRef.current?.contains(event.target as Node)) {
        setSearchOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setAccountMenuOpen(false);
        setNotifOpen(false);
        setSearchOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  useEffect(() => {
    const keyword = searchQuery.trim();
    setSelectedSearchIndex(0);

    if (keyword.length < 2) {
      setSearchGroups([]);
      setSearchError('');
      setSearchLoading(false);
      return;
    }

    let cancelled = false;
    setSearchLoading(true);
    const timer = window.setTimeout(() => {
      apiClient
        .get<AdminSearchResponse>(
          `/admin-search?q=${encodeURIComponent(keyword)}&limit=5`,
        )
        .then((data) => {
          if (cancelled) return;
          setSearchGroups(data.groups ?? []);
          setSearchError('');
          setSearchOpen(true);
        })
        .catch(() => {
          if (cancelled) return;
          setSearchGroups([]);
          setSearchError(
            isVietnamese
              ? 'Không thể tìm kiếm lúc này.'
              : 'Search is not available right now.',
          );
          setSearchOpen(true);
        })
        .finally(() => {
          if (!cancelled) setSearchLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isVietnamese, searchQuery]);

  const flatSearchItems = useMemo(
    () => searchGroups.flatMap((group) => group.items),
    [searchGroups],
  );

  const loadNotifications = async () => {
    setNotifLoading(true);
    try {
      const data = await apiClient.get<NotifItem[]>('/notifications/admin/summary');
      setNotifications(data ?? []);
    } catch {
      setNotifications([]);
    } finally {
      setNotifLoading(false);
    }
  };

  async function handleLogout() {
    setLoggingOut(true);

    try {
      await logoutAdmin();
      showToast({
        tone: 'info',
        title: isVietnamese ? 'Đã đăng xuất' : 'Signed out',
        description: isVietnamese
          ? 'Bạn đã quay về trang đăng nhập.'
          : 'You have been returned to the sign-in screen.',
      });
      navigate('/login', { replace: true });
    } finally {
      setLoggingOut(false);
      setAccountMenuOpen(false);
    }
  }

  function openSearchItem(item: AdminSearchItem) {
    setSearchOpen(false);
    setSearchQuery('');
    setSearchGroups([]);
    navigate(item.path);
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSearchOpen(true);
      setSelectedSearchIndex((current) =>
        flatSearchItems.length ? (current + 1) % flatSearchItems.length : 0,
      );
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSearchOpen(true);
      setSelectedSearchIndex((current) =>
        flatSearchItems.length
          ? (current - 1 + flatSearchItems.length) % flatSearchItems.length
          : 0,
      );
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const selected = flatSearchItems[selectedSearchIndex] ?? flatSearchItems[0];
      if (selected) {
        openSearchItem(selected);
      } else if (searchQuery.trim()) {
        navigate(`/admin/products?search=${encodeURIComponent(searchQuery.trim())}`);
        setSearchOpen(false);
      }
    }
  }

  function itemGlobalIndex(groupIndex: number, itemIndex: number) {
    return searchGroups
      .slice(0, groupIndex)
      .reduce((sum, group) => sum + group.items.length, itemIndex);
  }

  return (
    <header className="app-elevated-soft sticky top-0 z-30 flex h-20 items-center justify-between border-b border-on-surface-variant/5 px-4 backdrop-blur-xl sm:px-6 lg:px-10">
      <div className="flex min-w-0 flex-1 items-center gap-4 lg:gap-8">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="flex h-11 w-11 items-center justify-center rounded-2xl border border-on-surface-variant/10 bg-white text-on-surface shadow-sm transition hover:border-primary/20 hover:text-primary lg:hidden"
        >
          <Menu size={18} />
        </button>

        <div className="min-w-0">
          <h2 className="truncate text-lg font-black tracking-tight text-primary sm:text-xl">
            {isVietnamese ? 'Trung tâm điều hành' : 'Operations Center'}
          </h2>
        </div>

        <div ref={searchContainerRef} className="relative hidden w-full max-w-md lg:block">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50"
            size={18}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onFocus={() => {
              if (searchQuery.trim().length >= 2) setSearchOpen(true);
            }}
            onKeyDown={handleSearchKeyDown}
            placeholder={
              isVietnamese
                ? 'Tìm nhanh tài nguyên...'
                : 'Quick search across resources...'
            }
            className="w-full rounded-full border-none bg-on-surface-variant/5 py-2.5 pl-12 pr-6 text-sm transition-all focus:ring-2 focus:ring-primary/20"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSearchGroups([]);
                setSearchOpen(false);
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50 transition hover:text-primary"
            >
              <X size={16} />
            </button>
          ) : null}

          {searchOpen && (searchQuery.trim().length >= 2 || searchLoading) ? (
            <div className="absolute left-0 top-[calc(100%+0.75rem)] z-50 w-[34rem] overflow-hidden rounded-[1.75rem] border border-on-surface-variant/10 bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-on-surface-variant/8 px-5 py-3">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-on-surface-variant/60">
                  {isVietnamese ? 'Tìm kiếm toàn hệ thống' : 'Global search'}
                </p>
                {searchLoading ? (
                  <LoaderCircle size={15} className="animate-spin text-primary" />
                ) : null}
              </div>

              <div className="max-h-[28rem] overflow-y-auto p-3">
                {searchError ? (
                  <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                    {searchError}
                  </div>
                ) : !searchLoading && flatSearchItems.length === 0 ? (
                  <div className="rounded-2xl bg-on-surface-variant/5 px-4 py-8 text-center text-sm text-on-surface-variant">
                    {isVietnamese
                      ? `Không tìm thấy kết quả cho "${searchQuery.trim()}".`
                      : `No results for "${searchQuery.trim()}".`}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {searchGroups.map((group, groupIndex) => (
                      <div key={group.key}>
                        <p className="mb-1 px-2 text-[11px] font-black uppercase tracking-[0.18em] text-primary/70">
                          {group.label}
                        </p>
                        <div className="space-y-1">
                          {group.items.map((item, itemIndex) => {
                            const index = itemGlobalIndex(groupIndex, itemIndex);
                            const selected = index === selectedSearchIndex;
                            return (
                              <button
                                key={`${item.type}-${item.id}`}
                                type="button"
                                onMouseEnter={() => setSelectedSearchIndex(index)}
                                onClick={() => openSearchItem(item)}
                                className={`flex w-full items-center justify-between gap-4 rounded-2xl px-4 py-3 text-left transition ${
                                  selected
                                    ? 'bg-primary/10 text-primary'
                                    : 'hover:bg-on-surface-variant/5'
                                }`}
                              >
                                <span className="min-w-0">
                                  <span className="block truncate text-sm font-black text-on-surface">
                                    {item.title}
                                  </span>
                                  <span className="mt-0.5 block truncate text-xs text-on-surface-variant">
                                    {item.subtitle}
                                  </span>
                                </span>
                                <span className="shrink-0 rounded-full bg-on-surface-variant/8 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-on-surface-variant">
                                  {item.badge}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-on-surface-variant/8 px-5 py-3 text-[11px] font-semibold text-on-surface-variant/60">
                {isVietnamese
                  ? 'Enter để mở kết quả đang chọn, mũi tên để di chuyển.'
                  : 'Press Enter to open, use arrows to navigate.'}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-4 lg:gap-6">
        <nav className="mr-2 hidden items-center gap-6 md:flex">
          <button
            type="button"
            onClick={() => navigate('/admin/analytics')}
            className="text-sm font-medium text-on-surface-variant transition-colors hover:text-primary"
          >
            {isVietnamese ? 'Phân tích' : 'Analytics'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/admin/orders')}
            className="text-sm font-medium text-on-surface-variant transition-colors hover:text-primary"
          >
            {isVietnamese ? 'Vận hành' : 'Operations'}
          </button>
        </nav>

        <div className="flex items-center gap-3 border-l border-on-surface-variant/10 pl-3 text-on-surface-variant/80 sm:gap-4 sm:pl-4 lg:pl-6">
          <div ref={notifRef} className="relative">
            <button
              type="button"
              onClick={() => { if (!notifOpen) void loadNotifications(); setNotifOpen(o => !o); }}
              className="relative p-1 transition-colors hover:text-primary"
            >
              <Bell size={20} />
              {notifications.length > 0 && (
                <span className="absolute right-0 top-0 flex h-4 w-4 items-center justify-center rounded-full border-2 border-surface bg-red-500 text-[8px] font-black text-white">
                  {notifications.length > 9 ? '9+' : notifications.length}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 top-[calc(100%+0.75rem)] z-50 w-80 overflow-hidden rounded-[1.75rem] border border-on-surface-variant/10 bg-white shadow-2xl">
                <div className="flex items-center justify-between px-5 py-4 border-b border-on-surface-variant/8">
                  <p className="text-sm font-black text-on-surface">Thông báo</p>
                  <button onClick={() => void loadNotifications()} className="text-xs text-primary hover:underline">Làm mới</button>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifLoading ? (
                    <div className="flex justify-center py-8">
                      <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="py-10 text-center text-sm text-on-surface-variant">
                      Không có thông báo mới
                    </div>
                  ) : (
                    <div className="divide-y divide-on-surface-variant/5">
                      {notifications.slice(0, 10).map((n, i) => (
                        <div key={n.id ?? i} className="px-5 py-3.5 hover:bg-surface/50 transition">
                          <p className="text-sm font-semibold text-on-surface">{n.title}</p>
                          <p className="mt-0.5 text-xs text-on-surface-variant/70 line-clamp-2">{n.message}</p>
                          {n.createdAt && (
                            <p className="mt-1 text-[10px] text-on-surface-variant/40">
                              {new Date(n.createdAt).toLocaleString('vi-VN')}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex items-center gap-2 rounded-full border border-on-surface-variant/10 px-3 py-1.5 text-xs font-black uppercase tracking-widest transition-colors hover:border-primary/20 hover:text-primary"
            title={
              resolvedTheme === 'dark'
                ? isVietnamese
                  ? 'Chuyển sang giao diện sáng'
                  : 'Switch to light mode'
                : isVietnamese
                  ? 'Chuyển sang giao diện tối'
                  : 'Switch to dark mode'
            }
          >
            {resolvedTheme === 'dark' ? <SunMedium size={16} /> : <MoonStar size={16} />}
            <span className="hidden lg:inline">
              {themeMode === 'system'
                ? isVietnamese
                  ? 'Hệ thống'
                  : 'System'
                : resolvedTheme === 'dark'
                  ? isVietnamese
                    ? 'Sáng'
                    : 'Light'
                  : isVietnamese
                    ? 'Tối'
                    : 'Dark'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setLanguage(language === 'vi' ? 'en' : 'vi')}
            className="inline-flex items-center gap-2 p-1 transition-colors hover:text-primary"
            title={isVietnamese ? 'Chuyển ngôn ngữ' : 'Switch language'}
          >
            <Globe size={20} />
            <span className="hidden text-xs font-black uppercase tracking-widest lg:inline">
              {language === 'vi' ? 'VI' : 'EN'}
            </span>
          </button>

          <div ref={accountMenuRef} className="relative hidden sm:block">
            <button
              type="button"
              onClick={() => setAccountMenuOpen((current) => !current)}
              className="inline-flex items-center gap-2 rounded-full border border-on-surface-variant/10 bg-white px-2 py-1.5 text-on-surface transition hover:border-primary/20 hover:text-primary"
              title={isVietnamese ? 'Mở menu tài khoản' : 'Open account menu'}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary-fixed to-primary text-xs font-black text-primary">
                {initials || 'AD'}
              </span>
              <ChevronDown
                size={16}
                className={`transition-transform ${accountMenuOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {accountMenuOpen ? (
              <div className="app-elevated absolute right-0 top-[calc(100%+0.75rem)] z-50 w-80 overflow-hidden rounded-[1.75rem] border border-on-surface-variant/10 bg-white shadow-2xl">
                {/* Profile header */}
                <div className="bg-gradient-to-br from-primary/8 to-primary-container/10 px-5 py-5">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-fixed to-primary text-lg font-black text-white shadow-md">
                      {initials || 'AD'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-on-surface">
                        {session?.user.username || (isVietnamese ? 'Quản trị viên' : 'Administrator')}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-on-surface-variant">
                        {session?.user.email || 'admin@local'}
                      </p>
                      {session?.user.role && (
                        <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-primary">
                          <ShieldCheck size={10} />
                          {session.user.role.name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action items */}
                <div className="p-3">
                  <div className="grid gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        navigate('/admin/security');
                      }}
                      className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-on-surface transition hover:bg-on-surface-variant/5 hover:text-primary"
                    >
                      <ShieldCheck size={18} />
                      <span>{isVietnamese ? 'Bảo mật tài khoản' : 'Account security'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        navigate('/admin/settings');
                      }}
                      className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-on-surface transition hover:bg-on-surface-variant/5 hover:text-primary"
                    >
                      <Settings size={18} />
                      <span>{isVietnamese ? 'Cài đặt giao diện' : 'Appearance settings'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={toggleTheme}
                      className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-on-surface transition hover:bg-on-surface-variant/5 hover:text-primary"
                    >
                      {resolvedTheme === 'dark' ? <SunMedium size={18} /> : <MoonStar size={18} />}
                      <span>
                        {resolvedTheme === 'dark'
                          ? isVietnamese
                            ? 'Đổi sang giao diện sáng'
                            : 'Switch to light mode'
                          : isVietnamese
                            ? 'Đổi sang giao diện tối'
                            : 'Switch to dark mode'}
                      </span>
                    </button>
                  </div>

                  <div className="mt-2 border-t border-on-surface-variant/8 pt-2">
                    <button
                      type="button"
                      onClick={() => void handleLogout()}
                      disabled={loggingOut}
                      className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-black text-red-600 transition hover:bg-red-50 disabled:opacity-60"
                    >
                      <LogOut size={18} />
                      <span>
                        {loggingOut
                          ? isVietnamese
                            ? 'Đang đăng xuất...'
                            : 'Signing out...'
                          : isVietnamese
                            ? 'Đăng xuất'
                            : 'Sign out'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

      </div>
    </header>
  );
}
