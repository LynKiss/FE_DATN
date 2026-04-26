import {
  BarChart3,
  BookOpen,
  Calculator,
  ChevronDown,
  Coins,
  PackageX,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  FolderTree,
  Globe,
  Hash,
  KeyRound,
  LayoutDashboard,
  Layers,
  Leaf,
  Mail,
  MessageCircleMore,
  MessageSquare,
  MonitorSmartphone,
  Newspaper,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Star,
  TrendingUp,
  Truck,
  Users,
  Warehouse,
  X,
} from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAdminSession } from '../hooks/useAdminSession';
import { useLanguage } from '../i18n/language-context';

type SidebarProps = {
  open: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
};

type NavItem = {
  id: string;
  label: string;
  path?: string;
  icon: typeof LayoutDashboard;
  /**
   * Permission key cần để hiển thị item. Nếu có nhiều key, user cần ÍT NHẤT 1.
   * Bỏ trống = ai cũng thấy.
   */
  permissions?: string[];
  children?: Array<{
    id: string;
    label: string;
    path: string;
    permissions?: string[];
  }>;
};

export default function Sidebar({ open, onClose, collapsed, onToggleCollapse }: SidebarProps) {
  const location = useLocation();
  const { session } = useAdminSession();
  const { language } = useLanguage();
  const isVietnamese = language === 'vi';

  const navItems: NavItem[] = [
    {
      id: 'dashboard',
      label: isVietnamese ? 'Tổng quan' : 'Dashboard',
      icon: LayoutDashboard,
      path: '/admin',
      permissions: ['view_dashboard', 'manage_reports', 'view_reports'],
    },
    {
      id: 'products',
      label: isVietnamese ? 'Sản phẩm' : 'Products',
      icon: Package,
      permissions: ['manage_products', 'view_products'],
      children: [
        {
          id: 'products-all',
          label: isVietnamese ? 'Tất cả sản phẩm' : 'All products',
          path: '/admin/products',
          permissions: ['manage_products', 'view_products'],
        },
        {
          id: 'products-new',
          label: isVietnamese ? 'Thêm sản phẩm' : 'Add product',
          path: '/admin/products/new',
          permissions: ['manage_products'],
        },
        {
          id: 'products-import',
          label: isVietnamese ? 'Nhập kho thủ công' : 'Manual stock import',
          path: '/admin/products/import',
          permissions: ['manage_inventory'],
        },
        {
          id: 'products-damage',
          label: isVietnamese ? 'Hàng hỏng / trả hàng' : 'Damage & returns',
          path: '/admin/products/inventory-damage',
          permissions: ['manage_inventory'],
        },
        {
          id: 'products-lowstock',
          label: isVietnamese ? 'Tổng quan tồn kho' : 'Inventory overview',
          path: '/admin/products/inventory-lowstock',
          permissions: ['manage_inventory', 'view_inventory'],
        },
      ],
    },
    {
      id: 'categories',
      label: isVietnamese ? 'Danh mục' : 'Categories',
      icon: FolderTree,
      path: '/admin/categories',
      permissions: ['manage_categories', 'view_categories', 'manage_products'],
    },
    {
      id: 'subcategories',
      label: isVietnamese ? 'Danh mục phụ' : 'Subcategories',
      icon: Layers,
      path: '/admin/subcategories',
      permissions: ['manage_categories', 'view_categories', 'manage_products'],
    },
    {
      id: 'origins',
      label: isVietnamese ? 'Xuất xứ' : 'Origins',
      icon: Globe,
      path: '/admin/origins',
      permissions: ['manage_products', 'view_products'],
    },
    {
      id: 'tags',
      label: isVietnamese ? 'Nhãn sản phẩm' : 'Tags',
      icon: Hash,
      path: '/admin/tags',
      permissions: ['manage_products', 'view_products'],
    },
    {
      id: 'orders',
      label: isVietnamese ? 'Đơn hàng' : 'Orders',
      icon: ShoppingCart,
      path: '/admin/orders',
      permissions: ['manage_orders', 'view_orders'],
    },
    {
      id: 'returns',
      label: isVietnamese ? 'Trả hàng' : 'Returns',
      icon: PackageX,
      path: '/admin/returns',
      permissions: ['manage_returns', 'view_returns', 'manage_orders'],
    },
    {
      id: 'discounts',
      label: isVietnamese ? 'Chương trình giảm giá' : 'Discount programs',
      icon: Calculator,
      path: '/admin/discounts',
      permissions: ['manage_discounts', 'view_discounts'],
    },
    {
      id: 'customers',
      label: isVietnamese ? 'Tài khoản' : 'Customers',
      icon: Users,
      path: '/admin/customers',
      permissions: ['manage_customers', 'view_customers', 'manage_users', 'view_users'],
    },
    {
      id: 'news',
      label: isVietnamese ? 'Bài viết' : 'Articles',
      icon: Newspaper,
      path: '/admin/news',
      permissions: ['manage_news', 'view_news'],
    },
    {
      id: 'news-comments',
      label: isVietnamese ? 'Bình luận' : 'Comments',
      icon: MessageSquare,
      path: '/admin/news-comments',
      permissions: ['manage_news', 'view_news'],
    },
    {
      id: 'reviews',
      label: isVietnamese ? 'Đánh giá sản phẩm' : 'Product reviews',
      icon: Star,
      path: '/admin/reviews',
      permissions: ['manage_reviews'],
    },
    {
      id: 'payments',
      label: isVietnamese ? 'Thanh toán' : 'Payments',
      icon: CreditCard,
      path: '/admin/payments',
      permissions: ['manage_orders', 'view_orders'],
    },
    {
      id: 'support-chats',
      label: isVietnamese ? 'Chat hỗ trợ' : 'Support chat',
      icon: MessageCircleMore,
      path: '/admin/support-chats',
      permissions: ['manage_support'],
    },
    {
      id: 'rice-diagnosis',
      label: isVietnamese ? 'AI bệnh lúa' : 'Rice AI diagnosis',
      icon: Leaf,
      path: '/admin/rice-diagnosis',
      permissions: ['manage_ai_diagnosis'],
    },
    {
      id: 'suppliers',
      label: isVietnamese ? 'Nhà cung cấp' : 'Suppliers',
      icon: Truck,
      path: '/admin/suppliers',
      permissions: ['manage_suppliers', 'view_suppliers', 'manage_products'],
    },
    {
      id: 'procurement',
      label: isVietnamese ? 'Mua hàng' : 'Procurement',
      icon: ClipboardList,
      path: '/admin/procurement',
      permissions: ['manage_procurement', 'view_procurement', 'manage_products'],
    },
    {
      id: 'pricing',
      label: isVietnamese ? 'Định giá bán' : 'Pricing',
      icon: Calculator,
      path: '/admin/pricing',
      permissions: ['manage_products'],
    },
    {
      id: 'warehouses',
      label: isVietnamese ? 'Kho hàng' : 'Warehouses',
      icon: Warehouse,
      path: '/admin/warehouses',
      permissions: ['manage_inventory', 'view_inventory'],
    },
    {
      id: 'inventory-ledger',
      label: isVietnamese ? 'Sổ kho chi tiết' : 'Inventory Ledger',
      icon: BookOpen,
      path: '/admin/inventory-ledger',
      permissions: ['manage_inventory', 'view_inventory'],
    },
    {
      id: 'inventory-valuation',
      label: isVietnamese ? 'Giá trị tồn kho' : 'Inventory Valuation',
      icon: Coins,
      path: '/admin/inventory-valuation',
      permissions: ['manage_reports', 'view_reports'],
    },
    {
      id: 'profitability',
      label: isVietnamese ? 'Lợi nhuận thật' : 'Profitability',
      icon: TrendingUp,
      path: '/admin/profitability',
      permissions: ['manage_reports', 'view_reports'],
    },
    {
      id: 'aging-debt',
      label: isVietnamese ? 'Tuổi nợ NCC' : 'Aging Debt',
      icon: CreditCard,
      path: '/admin/aging-debt',
      permissions: ['manage_reports', 'view_reports'],
    },
    {
      id: 'credit-limits',
      label: isVietnamese ? 'Hạn mức công nợ' : 'Credit Limits',
      icon: ClipboardList,
      path: '/admin/credit-limits',
      permissions: ['manage_customers', 'manage_users'],
    },
    {
      id: 'audit-logs',
      label: isVietnamese ? 'Nhật ký thao tác' : 'Audit Logs',
      icon: ClipboardCheck,
      path: '/admin/audit-logs',
      permissions: ['manage_audit_logs', 'view_audit_logs', 'manage_permissions'],
    },
    {
      id: 'newsletter',
      label: isVietnamese ? 'Newsletter' : 'Newsletter',
      icon: Mail,
      path: '/admin/newsletter',
      permissions: ['manage_news'],
    },
    {
      id: 'reports',
      label: isVietnamese ? 'Báo cáo' : 'Reports',
      icon: BarChart3,
      path: '/admin/reports',
      permissions: ['manage_reports', 'view_reports'],
    },
    {
      id: 'permissions',
      label: isVietnamese ? 'Phân quyền' : 'Permissions',
      icon: KeyRound,
      path: '/admin/permissions',
      permissions: ['manage_permissions'],
    },
    {
      id: 'interface',
      label: isVietnamese ? 'Giao diện' : 'Interface',
      icon: MonitorSmartphone,
      path: '/admin/interface',
      permissions: ['manage_interface'],
    },
    {
      id: 'security',
      label: isVietnamese ? 'Bảo mật' : 'Security',
      icon: ShieldCheck,
      path: '/admin/security',
      permissions: ['manage_settings', 'manage_permissions'],
    },
    {
      id: 'settings',
      label: isVietnamese ? 'Cấu hình' : 'Settings',
      icon: Settings,
      path: '/admin/settings',
      permissions: ['manage_settings', 'view_settings'],
    },
  ];

  // Filter sidebar items theo permissions của user.
  // ADMIN có 'manage_permissions' → hiện tất cả.
  // STAFF / VIEWER chỉ thấy các mục có ÍT NHẤT 1 permission khớp.
  const userPermSet = new Set(
    (session?.user.permissions ?? []).map((p) => p.key),
  );
  const isAdmin = userPermSet.has('manage_permissions');

  const itemHasAccess = (perms?: string[]): boolean => {
    if (!perms || perms.length === 0) return true; // public item
    if (isAdmin) return true; // admin always has access
    return perms.some((key) => userPermSet.has(key));
  };

  const filteredNavItems = navItems
    .map((item) => {
      if (item.children) {
        const visibleChildren = item.children.filter((c) =>
          itemHasAccess(c.permissions),
        );
        if (visibleChildren.length === 0 && !itemHasAccess(item.permissions)) {
          return null;
        }
        return { ...item, children: visibleChildren };
      }
      return itemHasAccess(item.permissions) ? item : null;
    })
    .filter((item): item is NavItem => item !== null);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    products: location.pathname.startsWith('/admin/products'),
  });

  useEffect(() => {
    if (location.pathname.startsWith('/admin/products')) {
      setOpenGroups((current) => ({ ...current, products: true }));
    }
  }, [location.pathname]);

  const displayName =
    session?.user.username || (isVietnamese ? 'Quản trị viên' : 'Administrator');
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return (
    <>
      <button
        type="button"
        aria-label={isVietnamese ? 'Đóng thanh điều hướng' : 'Close navigation'}
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-slate-950/50 transition-opacity lg:hidden ${open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
          }`}
      />

      <aside
        className={`fixed left-0 top-0 z-50 flex h-dvh flex-col overflow-hidden bg-sidebar-bg shadow-2xl transition-all duration-300 ${collapsed ? 'lg:w-16' : 'lg:w-64'
          } w-72 max-w-[85vw] p-3 lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        {/* Header */}
        <div className={`mb-4 flex items-start gap-3 px-2 lg:mb-3 ${collapsed ? 'lg:flex-col lg:items-center' : 'justify-between'}`}>
          {!collapsed && (
            <div className="min-w-0 flex-1 lg:block hidden">
              <h1 className="text-lg font-black uppercase tracking-widest text-white truncate">
                Cultivated Ledger
              </h1>
              <p className="mt-0.5 text-[10px] font-medium text-accent/60">
                {isVietnamese ? 'Bảng điều khiển quản trị' : 'Administrative console'}
              </p>
            </div>
          )}

          {/* Mobile: title + close */}
          <div className="flex w-full items-start justify-between lg:hidden">
            <div>
              <h1 className="text-xl font-black uppercase tracking-widest text-white">
                Cultivated Ledger
              </h1>
              <p className="mt-1 text-xs font-medium text-accent/60">
                {isVietnamese ? 'Bảng điều khiển quản trị' : 'Administrative console'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          {/* Desktop collapse toggle */}
          <button
            type="button"
            onClick={onToggleCollapse}
            title={collapsed ? (isVietnamese ? 'Mở rộng' : 'Expand') : (isVietnamese ? 'Thu nhỏ' : 'Collapse')}
            className="hidden lg:flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/60 transition hover:bg-white/10 hover:text-white shrink-0"
          >
            {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
          </button>
        </div>

        <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto">
          <nav className="flex flex-col gap-0.5">
            {filteredNavItems.map((item) => {
              if (item.children) {
                const isGroupActive = item.children.some(
                  (child) => location.pathname === child.path,
                );
                const isOpen = openGroups[item.id] ?? false;

                if (collapsed) {
                  return (
                    <NavLink
                      key={item.id}
                      to={item.children[0]?.path ?? '/admin/products'}
                      onClick={onClose}
                      title={item.label}
                      className={`hidden lg:flex h-10 w-10 mx-auto items-center justify-center rounded-xl transition-all duration-200 ${isGroupActive
                        ? 'bg-accent text-primary'
                        : 'text-white/60 hover:bg-white/5 hover:text-white'
                        }`}
                    >
                      <item.icon size={18} />
                    </NavLink>
                  );
                }

                return (
                  <div key={item.id} className="rounded-[1.5rem]">
                    <div
                      className={`flex items-center rounded-full text-sm font-medium transition-all duration-200 ${isGroupActive || isOpen
                        ? 'bg-white/8 text-white'
                        : 'text-white/60 hover:bg-white/5 hover:text-white'
                        }`}
                    >
                      <NavLink
                        to={item.children[0]?.path ?? '/admin/products'}
                        onClick={onClose}
                        className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5"
                      >
                        <item.icon size={18} />
                        <span>{item.label}</span>
                      </NavLink>
                      <button
                        type="button"
                        onClick={() =>
                          setOpenGroups((current) => ({
                            ...current,
                            [item.id]: !current[item.id],
                          }))
                        }
                        className="mr-2 flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-white/10"
                      >
                        <ChevronDown
                          size={16}
                          className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
                        />
                      </button>
                    </div>

                    {isOpen ? (
                      <div className="mt-1 space-y-0.5 pl-4">
                        {item.children.map((child) => (
                          <NavLink
                            key={child.id}
                            to={child.path}
                            onClick={onClose}
                            className={({ isActive }) =>
                              `flex items-center gap-2.5 rounded-xl px-3 py-1.5 text-xs transition ${isActive
                                ? 'bg-accent font-bold text-primary shadow-sm shadow-accent/20'
                                : 'text-white/60 hover:bg-white/5 hover:text-white'
                              }`
                            }
                          >
                            <span className="h-1 w-1 shrink-0 rounded-full bg-current opacity-60" />
                            <span>{child.label}</span>
                          </NavLink>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              }

              if (collapsed) {
                return (
                  <NavLink
                    key={item.id}
                    to={item.path ?? '/admin'}
                    onClick={onClose}
                    title={item.label}
                    className={({ isActive }) =>
                      `hidden lg:flex h-10 w-10 mx-auto items-center justify-center rounded-xl transition-all duration-200 ${isActive
                        ? 'bg-accent text-primary'
                        : 'text-white/60 hover:bg-white/5 hover:text-white'
                      }`
                    }
                  >
                    <item.icon size={18} />
                  </NavLink>
                );
              }

              return (
                <NavLink
                  key={item.id}
                  to={item.path ?? '/admin'}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-full px-3 py-2.5 text-sm font-medium transition-all duration-200 ${isActive
                      ? 'bg-accent font-bold text-primary shadow-lg shadow-accent/20'
                      : 'text-white/60 hover:bg-white/5 hover:text-white active:scale-95'
                    }`
                  }
                >
                  <item.icon size={18} />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {!collapsed && (
          <div className="mt-4 border-t border-white/5 pt-4">
            <div className="flex items-center gap-3 rounded-2xl bg-white/5 p-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-accent/20 bg-accent/20 font-bold text-accent text-sm">
                {initials || 'AD'}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{displayName}</p>
                <p className="truncate text-xs text-white/40">
                  {session?.user.email || (isVietnamese ? 'phiên quản trị' : 'admin session')}
                </p>
              </div>
            </div>
          </div>
        )}

        {collapsed && (
          <div className="mt-4 hidden border-t border-white/5 pt-4 lg:flex justify-center">
            <div
              title={displayName}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-accent/20 bg-accent/20 font-bold text-accent text-sm"
            >
              {initials || 'AD'}
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
