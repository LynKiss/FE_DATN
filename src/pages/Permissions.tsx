import { useEffect, useMemo, useState } from 'react';
import { LoaderCircle, Save, ShieldCheck } from 'lucide-react';
import { apiClient } from '../lib/api';
import { useLanguage } from '../i18n/language-context';
import { useToast } from '../hooks/useToast';
import { useAdminSession } from '../hooks/useAdminSession';

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

  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedRole, setSelectedRole] = useState('admin');
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canManagePermissions =
    session?.user.permissions?.some((p) => p.key === 'manage_permissions') ?? false;

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

        setRoles(rolesData);
        setPermissions(permissionsData);

        const initialRole = rolesData[0]?.name ?? 'admin';
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
    return () => {
      cancelled = true;
    };
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
            title: isVietnamese
              ? 'Không tải được quyền của vai trò'
              : 'Unable to load role permissions',
            description: loadError instanceof Error ? loadError.message : '',
          });
        }
      }
    }

    void loadRolePermissions();
    return () => {
      cancelled = true;
    };
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

  if (!canManagePermissions) {
    return (
      <div className="rounded-[2rem] border border-amber-200 bg-amber-50 p-8 text-amber-800">
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

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-primary">
            {isVietnamese ? 'Phân quyền truy cập' : 'Access Permissions'}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-on-surface-variant">
            {isVietnamese
              ? 'Gán quyền truy cập cho từng vai trò quản trị và nhân viên theo module nghiệp vụ.'
              : 'Assign role access by business module for admin and staff users.'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || loading}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-container px-6 py-3 text-sm font-black text-white shadow-xl shadow-primary/20 transition-all hover:-translate-y-0.5 disabled:opacity-60"
        >
          {saving ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />}
          {isVietnamese ? 'Lưu phân quyền' : 'Save permissions'}
        </button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="rounded-[2.5rem] border border-on-surface-variant/5 bg-white p-8 shadow-sm">
        <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
          <div className="space-y-3">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-on-surface-variant/60">
              {isVietnamese ? 'Vai trò' : 'Roles'}
            </p>
            {loading ? (
              <div className="rounded-2xl bg-surface px-4 py-6 text-center text-on-surface-variant">
                <LoaderCircle size={18} className="mx-auto animate-spin" />
              </div>
            ) : (
              roles.map((role) => (
                <button
                  key={role._id}
                  type="button"
                  onClick={() => setSelectedRole(role.name)}
                  className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                    selectedRole === role.name
                      ? 'border-primary/30 bg-primary/5 text-primary'
                      : 'border-on-surface/8 bg-surface text-on-surface hover:border-primary/15'
                  }`}
                >
                  <div>
                    <p className="font-bold capitalize">{role.name}</p>
                    <p className="text-xs text-on-surface-variant/60">
                      {role.name === 'admin'
                        ? isVietnamese ? 'Quản trị viên' : 'Administrator'
                        : role.name === 'staff'
                          ? isVietnamese ? 'Nhân viên' : 'Staff'
                          : isVietnamese ? 'Người dùng' : 'User'}
                    </p>
                  </div>
                  <ShieldCheck
                    size={16}
                    className={selectedRole === role.name ? 'text-primary' : 'text-on-surface-variant/30'}
                  />
                </button>
              ))
            )}
          </div>

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

            {loading ? (
              <div className="rounded-2xl bg-surface px-4 py-10 text-center text-on-surface-variant">
                <LoaderCircle size={18} className="mx-auto animate-spin" />
              </div>
            ) : groupedPermissions.length === 0 ? (
              <div className="rounded-2xl bg-surface px-4 py-10 text-center text-sm text-on-surface-variant">
                {isVietnamese
                  ? 'Chưa có quyền nào trong hệ thống'
                  : 'No permissions in the system'}
              </div>
            ) : (
              groupedPermissions.map(([groupName, items]) => (
                <div
                  key={groupName}
                  className="overflow-hidden rounded-[1.5rem] border border-on-surface/8"
                >
                  <div className="flex items-center justify-between bg-surface/70 px-5 py-3">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-on-surface-variant/70">
                      {getGroupLabel(groupName, isVietnamese)}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        const groupIds = items.map((p) => p._id);
                        const allSelected = groupIds.every((id) =>
                          selectedPermissionIds.includes(id),
                        );
                        setSelectedPermissionIds((current) =>
                          allSelected
                            ? current.filter((id) => !groupIds.includes(id))
                            : [...new Set([...current, ...groupIds])],
                        );
                      }}
                      className="text-[11px] font-bold text-primary/70 hover:text-primary"
                    >
                      {items.every((p) => selectedPermissionIds.includes(p._id))
                        ? isVietnamese
                          ? 'Bỏ chọn tất cả'
                          : 'Deselect all'
                        : isVietnamese
                          ? 'Chọn tất cả'
                          : 'Select all'}
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
