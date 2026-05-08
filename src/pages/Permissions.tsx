import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Info,
  KeyRound,
  LoaderCircle,
  Save,
  ShieldCheck,
  ShieldAlert,
  ExternalLink,
} from 'lucide-react';
import { apiClient } from '../lib/api';
import { useLanguage } from '../i18n/language-context';
import { useToast } from '../hooks/useToast';
import { useAdminSession } from '../hooks/useAdminSession';
import { useSuperAdminSession } from '../hooks/useSuperAdminSession';

type Permission = {
  _id: string;
  key: string;
  name: string;
};

type Role = {
  _id: string;
  name: string;
  permissions: Permission[];
};

type RolePermissionsResponse = {
  role: string;
  permissions: Permission[];
};

const GROUP_LABELS: Record<string, { vi: string; en: string }> = {
  products: { vi: 'Sản phẩm', en: 'Products' },
  orders: { vi: 'Đơn hàng', en: 'Orders' },
  permissions: { vi: 'Phân quyền', en: 'Permissions' },
  news: { vi: 'Bài viết', en: 'News' },
  reports: { vi: 'Báo cáo', en: 'Reports' },
  users: { vi: 'Người dùng', en: 'Users' },
  general: { vi: 'Chung', en: 'General' },
  inventory: { vi: 'Kho hàng', en: 'Inventory' },
  settings: { vi: 'Cài đặt', en: 'Settings' },
  interface: { vi: 'Giao diện', en: 'Interface' },
  discounts: { vi: 'Khuyến mãi', en: 'Discounts' },
  delivery: { vi: 'Vận chuyển', en: 'Delivery' },
};

// Roles that should NOT appear in admin permission management
const EXCLUDED_ROLES = ['customer'];

const ROLE_META: Record<string, { vi: string; en: string; warning?: { vi: string; en: string } }> = {
  admin: {
    vi: 'Quản trị viên',
    en: 'Administrator',
    warning: {
      vi: 'Thay đổi này áp dụng cho TẤT CẢ tài khoản admin — trừ những tài khoản đã được cấp quyền riêng qua Central Super Admin.',
      en: 'This change applies to ALL admin accounts — except those with individual permission overrides via Central Super Admin.',
    },
  },
  staff: {
    vi: 'Nhân viên',
    en: 'Staff',
  },
};

function getGroupLabel(key: string, isVietnamese: boolean): string {
  const entry = GROUP_LABELS[key];
  if (entry) return isVietnamese ? entry.vi : entry.en;
  return key.charAt(0).toUpperCase() + key.slice(1);
}

export default function Permissions() {
  const { language } = useLanguage();
  const isVietnamese = language === 'vi';
  const { showToast } = useToast();
  const { session } = useAdminSession();
  const { session: superSession } = useSuperAdminSession();

  const isSuperAdmin = !!superSession?.user?.isSuperAdmin;

  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedRole, setSelectedRole] = useState('admin');
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmSave, setConfirmSave] = useState(false);

  const canManagePermissions =
    session?.user.permissions?.some((p) => p.key === 'manage_permissions') ?? false;

  const adminRoles = useMemo(
    () => roles.filter((r) => !EXCLUDED_ROLES.includes(r.name)),
    [roles],
  );

  const selectedRoleMeta = ROLE_META[selectedRole];

  useEffect(() => {
    if (!canManagePermissions) return;
    let cancelled = false;
    async function loadInitialData() {
      setLoading(true);
      setError(null);
      try {
        const [rolesData, permissionsData] = await Promise.all([
          apiClient.get<Role[]>('/roles'),
          apiClient.get<Permission[]>('/permissions'),
        ]);
        if (cancelled) return;
        // Filter out customer role before setting state
        setRoles(rolesData.filter((r) => !EXCLUDED_ROLES.includes(r.name)));
        setPermissions(permissionsData);
        const initialRole = rolesData.find((r) => r.name === 'admin')?.name ?? rolesData[0]?.name ?? 'admin';
        setSelectedRole(initialRole);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : isVietnamese
                ? 'Không tải được dữ liệu phân quyền'
                : 'Unable to load permission data',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadInitialData();
    return () => { cancelled = true; };
  }, [canManagePermissions, isVietnamese]);

  useEffect(() => {
    if (!canManagePermissions || !selectedRole) return;
    let cancelled = false;
    async function loadRolePermissions() {
      try {
        const response = await apiClient.get<RolePermissionsResponse>(
          `/permissions/roles/${selectedRole}`,
        );
        if (!cancelled) {
          setSelectedPermissionIds(response.permissions.map((p) => p._id));
        }
      } catch (loadError) {
        if (!cancelled) {
          showToast({
            tone: 'error',
            title: isVietnamese ? 'Không tải được quyền của vai trò' : 'Unable to load role permissions',
            description: loadError instanceof Error ? loadError.message : '',
          });
        }
      }
    }
    void loadRolePermissions();
    return () => { cancelled = true; };
  }, [canManagePermissions, selectedRole, isVietnamese, showToast]);

  const groupedPermissions = useMemo(() => {
    const groups = new Map<string, Permission[]>();
    for (const permission of permissions) {
      const prefix = permission.key.split('_')[1] ?? 'general';
      const bucket = groups.get(prefix) ?? [];
      bucket.push(permission);
      groups.set(prefix, bucket);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [permissions]);

  async function handleSave() {
    setConfirmSave(false);
    setSaving(true);
    try {
      await apiClient.put(`/permissions/roles/${selectedRole}`, {
        permissionIds: selectedPermissionIds,
      });
      showToast({
        tone: 'success',
        title: isVietnamese ? 'Đã cập nhật phân quyền' : 'Permissions updated',
      });
    } catch (saveError) {
      showToast({
        tone: 'error',
        title: isVietnamese ? 'Cập nhật phân quyền thất bại' : 'Failed to update permissions',
        description: saveError instanceof Error ? saveError.message : '',
      });
    } finally {
      setSaving(false);
    }
  }

  // ── Super admin nhưng không có manage_permissions ───────────────────────────
  if (isSuperAdmin && !canManagePermissions) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-primary">
            {isVietnamese ? 'Phân quyền truy cập' : 'Access Permissions'}
          </h1>
        </div>

        {/* Super admin info banner */}
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100">
              <ShieldAlert size={20} className="text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="font-black text-blue-800">
                {isVietnamese ? 'Bạn đang đăng nhập với tư cách Central Super Admin' : 'You are logged in as Central Super Admin'}
              </p>
              <p className="mt-1 text-sm text-blue-700">
                {isVietnamese
                  ? 'Trang này quản lý quyền mặc định theo vai trò (áp dụng cho tất cả admin/staff). Để truy cập, cần đăng nhập bằng tài khoản admin cục bộ có quyền manage_permissions.'
                  : 'This page manages default role-based permissions. To access it, log in with a local admin account that has manage_permissions.'}
              </p>
              <div className="mt-4 rounded-xl border border-blue-200 bg-white p-4 text-sm text-blue-800">
                <p className="font-bold">
                  {isVietnamese ? '🔑 Phân biệt 2 lớp phân quyền:' : '🔑 Two-tier permission system:'}
                </p>
                <ul className="mt-2 space-y-1.5 text-blue-700">
                  <li>
                    <span className="font-semibold">{isVietnamese ? 'Lớp 1 — Role defaults (trang này):' : 'Layer 1 — Role defaults (this page):'}</span>
                    {' '}
                    {isVietnamese
                      ? 'Quyền áp dụng mặc định cho tất cả admin hoặc tất cả staff.'
                      : 'Permissions applied by default to all admins or all staff.'}
                  </li>
                  <li>
                    <span className="font-semibold">{isVietnamese ? 'Lớp 2 — Individual overrides (Central Super Admin):' : 'Layer 2 — Individual overrides (Central Super Admin):'}</span>
                    {' '}
                    {isVietnamese
                      ? 'Ghi đè quyền cho từng admin cụ thể. Lớp này ưu tiên cao hơn role defaults.'
                      : 'Override permissions for a specific admin. This layer takes priority over role defaults.'}
                  </li>
                </ul>
              </div>
              <Link
                to="/admin/super-admin"
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700"
              >
                <KeyRound size={14} />
                {isVietnamese ? 'Quản lý quyền riêng từng admin' : 'Manage individual admin permissions'}
                <ExternalLink size={12} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Không có quyền (admin thường không có manage_permissions) ───────────────
  if (!canManagePermissions) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-8 text-amber-800">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100">
          <ShieldCheck size={24} />
        </div>
        <h1 className="mt-4 text-2xl font-black">
          {isVietnamese ? 'Không đủ quyền truy cập' : 'Access denied'}
        </h1>
        <p className="mt-2 text-sm">
          {isVietnamese
            ? 'Tài khoản hiện tại không có quyền manage_permissions để vào trang phân quyền.'
            : 'The current account does not have manage_permissions access.'}
        </p>
      </div>
    );
  }

  // ── Main page ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-black tracking-tight text-primary">
              {isVietnamese ? 'Phân quyền truy cập' : 'Access Permissions'}
            </h1>
            {isSuperAdmin && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-xs font-black text-blue-700">
                <ShieldAlert size={11} />
                Central Super Admin
              </span>
            )}
          </div>
          <p className="mt-2 max-w-2xl text-sm text-on-surface-variant">
            {isVietnamese
              ? 'Cấu hình quyền mặc định theo vai trò. Quyền riêng của từng admin được quản lý qua Central Super Admin.'
              : 'Configure default role permissions. Individual admin overrides are managed via Central Super Admin.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Link to individual overrides */}
          <Link
            to="/admin/super-admin"
            className="inline-flex items-center gap-2 rounded-xl border border-on-surface/15 bg-surface px-4 py-2.5 text-sm font-bold text-on-surface-variant transition hover:border-primary/30 hover:text-primary"
          >
            <KeyRound size={14} />
            {isVietnamese ? 'Quyền cá nhân' : 'Individual overrides'}
            <ExternalLink size={12} />
          </Link>

          {/* Save button — shows confirm for admin role */}
          {confirmSave ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-amber-600">
                {isVietnamese ? 'Xác nhận lưu?' : 'Confirm save?'}
              </span>
              <button
                type="button"
                onClick={() => setConfirmSave(false)}
                className="rounded-xl border border-on-surface/15 px-3 py-2 text-sm font-bold text-on-surface-variant hover:bg-surface"
              >
                {isVietnamese ? 'Hủy' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-sm font-black text-white shadow-sm disabled:opacity-60"
              >
                {saving ? <LoaderCircle size={14} className="animate-spin" /> : <Save size={14} />}
                {isVietnamese ? 'Lưu ngay' : 'Confirm'}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmSave(true)}
              disabled={saving || loading}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-black text-white shadow-sm shadow-primary/20 transition-all hover:-translate-y-0.5 disabled:opacity-60"
            >
              {saving ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />}
              {isVietnamese ? 'Lưu phân quyền' : 'Save permissions'}
            </button>
          )}
        </div>
      </div>

      {/* Two-tier explanation banner */}
      <div className="flex items-start gap-3 rounded-2xl border border-blue-200/60 bg-blue-50/60 px-5 py-4">
        <Info size={15} className="mt-0.5 shrink-0 text-blue-500" />
        <p className="text-sm text-blue-700">
          {isVietnamese ? (
            <>
              <span className="font-bold">Quyền theo vai trò (trang này)</span> là mặc định áp dụng cho tất cả người có vai trò đó.{' '}
              <span className="font-bold">Quyền cá nhân</span> do Central Super Admin cấp sẽ ghi đè toàn bộ quyền role này.{' '}
              Nếu một admin có quyền cá nhân, thay đổi ở đây <span className="font-bold">không ảnh hưởng</span> đến họ.
            </>
          ) : (
            <>
              <span className="font-bold">Role permissions (this page)</span> are defaults applied to everyone with that role.{' '}
              <span className="font-bold">Individual permissions</span> granted by Central Super Admin override these entirely.{' '}
              Admins with individual overrides are <span className="font-bold">not affected</span> by changes here.
            </>
          )}
        </p>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="rounded-xl border border-on-surface-variant/5 bg-white p-8 shadow-sm">
        <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
          {/* Role list */}
          <div className="space-y-3">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-on-surface-variant/60">
              {isVietnamese ? 'Vai trò' : 'Roles'}
            </p>
            {loading ? (
              <div className="rounded-2xl bg-surface px-4 py-6 text-center text-on-surface-variant">
                <LoaderCircle size={18} className="mx-auto animate-spin" />
              </div>
            ) : (
              adminRoles.map((role) => {
                const meta = ROLE_META[role.name];
                return (
                  <button
                    key={role._id}
                    type="button"
                    onClick={() => { setSelectedRole(role.name); setConfirmSave(false); }}
                    className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                      selectedRole === role.name
                        ? 'border-primary/30 bg-primary/5 text-primary'
                        : 'border-on-surface/8 bg-surface text-on-surface hover:border-primary/15'
                    }`}
                  >
                    <div>
                      <p className="font-bold capitalize">{role.name}</p>
                      <p className="text-xs text-on-surface-variant/60">
                        {meta ? (isVietnamese ? meta.vi : meta.en) : role.name}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <ShieldCheck
                        size={16}
                        className={selectedRole === role.name ? 'text-primary' : 'text-on-surface-variant/30'}
                      />
                      {role.name === 'admin' && (
                        <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-black text-amber-600">
                          {isVietnamese ? 'Ảnh hưởng diện rộng' : 'Wide impact'}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Permissions editor */}
          <div className="space-y-5">
            <div className="flex items-center justify-between rounded-2xl bg-primary/5 px-5 py-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-on-surface-variant/60">
                  {isVietnamese ? 'Đang chỉnh vai trò' : 'Editing role'}
                </p>
                <p className="mt-1 text-xl font-black capitalize text-primary">{selectedRole}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-on-surface-variant/60">
                  {isVietnamese ? 'Số quyền đang chọn' : 'Selected permissions'}
                </p>
                <p className="mt-1 text-xl font-black text-primary">{selectedPermissionIds.length}</p>
              </div>
            </div>

            {/* Warning for admin role */}
            {selectedRoleMeta?.warning && (
              <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-500" />
                <p className="text-xs text-amber-700">
                  {isVietnamese ? selectedRoleMeta.warning.vi : selectedRoleMeta.warning.en}
                </p>
              </div>
            )}

            {loading ? (
              <div className="rounded-2xl bg-surface px-4 py-10 text-center text-on-surface-variant">
                <LoaderCircle size={18} className="mx-auto animate-spin" />
              </div>
            ) : groupedPermissions.length === 0 ? (
              <div className="rounded-2xl bg-surface px-4 py-10 text-center text-sm text-on-surface-variant">
                {isVietnamese ? 'Chưa có quyền nào trong hệ thống' : 'No permissions in the system'}
              </div>
            ) : (
              groupedPermissions.map(([groupName, items]) => (
                <div key={groupName} className="overflow-hidden rounded-xl border border-on-surface/8">
                  <div className="flex items-center justify-between bg-surface/70 px-5 py-3">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-on-surface-variant/70">
                      {getGroupLabel(groupName, isVietnamese)}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        const groupIds = items.map((p) => p._id);
                        const allSelected = groupIds.every((id) => selectedPermissionIds.includes(id));
                        setSelectedPermissionIds((current) =>
                          allSelected
                            ? current.filter((id) => !groupIds.includes(id))
                            : [...new Set([...current, ...groupIds])],
                        );
                      }}
                      className="text-[11px] font-bold text-primary/70 hover:text-primary"
                    >
                      {items.every((p) => selectedPermissionIds.includes(p._id))
                        ? isVietnamese ? 'Bỏ chọn tất cả' : 'Deselect all'
                        : isVietnamese ? 'Chọn tất cả' : 'Select all'}
                    </button>
                  </div>
                  <div className="grid gap-3 p-4 md:grid-cols-2">
                    {items.map((permission) => (
                      <label
                        key={permission._id}
                        className="flex cursor-pointer items-start gap-3 rounded-2xl bg-surface px-4 py-3 transition hover:bg-primary/3"
                      >
                        <input
                          type="checkbox"
                          checked={selectedPermissionIds.includes(permission._id)}
                          onChange={() =>
                            setSelectedPermissionIds((current) =>
                              current.includes(permission._id)
                                ? current.filter((item) => item !== permission._id)
                                : [...current, permission._id],
                            )
                          }
                          className="mt-1 h-4 w-4 accent-primary"
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-on-surface">{permission.name}</p>
                          <p className="mt-0.5 truncate text-xs text-on-surface-variant/60">
                            {permission.key}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
