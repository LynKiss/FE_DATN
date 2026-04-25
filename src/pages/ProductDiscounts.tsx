import { useEffect, useState, useCallback } from 'react';
import {
  BadgePercent,
  CalendarClock,
  Edit2,
  LoaderCircle,
  Plus,
  Save,
  Tags,
  Trash2,
  ToggleLeft,
  ToggleRight,
  BarChart2,
} from 'lucide-react';
import { apiClient } from '../lib/api';
import { useLanguage } from '../i18n/language-context';
import { useToast } from '../hooks/useToast';
import Modal from '../components/shared/Modal';

type Discount = {
  discountId: string;
  discountCode: string;
  discountName: string;
  discountType: 'percent' | 'fixed';
  discountValue: string;
  appliesTo: 'order' | 'category' | 'product';
  startAt: string;
  expireDate: string;
  isActive: boolean;
  usageLimit: number | null;
  usedCount: number;
  minOrderValue: string;
  maxDiscountAmount: string | null;
  discountDescription: string | null;
  userId: string | null;
  categoryIds?: string[];
  productIds?: string[];
  stats?: { totalUsage: number; uniqueUsers: number };
  isExpired?: boolean;
  isStarted?: boolean;
};

type Category = { categoryId: string; categoryName: string };
type Product = { productId: string; productName: string };

type DiscountFormState = {
  discountCode: string;
  discountName: string;
  discountType: 'percent' | 'fixed';
  appliesTo: 'order' | 'category' | 'product';
  discountValue: string;
  startAt: string;
  expireDate: string;
  isActive: boolean;
  usageLimit: string;
  minOrderValue: string;
  maxDiscountAmount: string;
  discountDescription: string;
  userId: string;
  categoryIds: string[];
  productIds: string[];
};

const defaultForm: DiscountFormState = {
  discountCode: '',
  discountName: '',
  discountType: 'percent',
  appliesTo: 'order',
  discountValue: '',
  startAt: '',
  expireDate: '',
  isActive: true,
  usageLimit: '',
  minOrderValue: '0',
  maxDiscountAmount: '',
  discountDescription: '',
  userId: '',
  categoryIds: [],
  productIds: [],
};

function toDatetimeLocal(iso: string) {
  if (!iso) return '';
  return new Date(iso).toISOString().slice(0, 16);
}

export default function ProductDiscounts() {
  const { language } = useLanguage();
  const isVietnamese = language === 'vi';
  const { showToast } = useToast();

  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Discount | null>(null);
  const [form, setForm] = useState<DiscountFormState>(defaultForm);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [statsTarget, setStatsTarget] = useState<Discount | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const loadDiscounts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<Discount[]>('/discounts/admin');
      setDiscounts(data);
    } catch (err) {
      showToast({
        tone: 'error',
        title: isVietnamese ? 'Lỗi tải danh sách' : 'Failed to load discounts',
        description: err instanceof Error ? err.message : '',
      });
    } finally {
      setLoading(false);
    }
  }, [isVietnamese, showToast]);

  useEffect(() => {
    void loadDiscounts();

    async function loadRefs() {
      try {
        const [catData, proData] = await Promise.all([
          apiClient.get<Category[]>('/categories'),
          apiClient.get<{ items: Product[] }>('/products?includeHidden=true&limit=500'),
        ]);
        setCategories(catData ?? []);
        setProducts(proData.items ?? []);
      } catch {
        // silently fail
      }
    }
    void loadRefs();
  }, [loadDiscounts]);

  function openCreate() {
    setEditTarget(null);
    setForm(defaultForm);
    setFormOpen(true);
  }

  async function openEdit(id: string) {
    try {
      const data = await apiClient.get<Discount>(`/discounts/admin/${id}`);
      setEditTarget(data);
      setForm({
        discountCode: data.discountCode,
        discountName: data.discountName,
        discountType: data.discountType,
        appliesTo: data.appliesTo,
        discountValue: data.discountValue,
        startAt: toDatetimeLocal(data.startAt),
        expireDate: toDatetimeLocal(data.expireDate),
        isActive: data.isActive,
        usageLimit: data.usageLimit != null ? String(data.usageLimit) : '',
        minOrderValue: data.minOrderValue ?? '0',
        maxDiscountAmount: data.maxDiscountAmount ?? '',
        discountDescription: data.discountDescription ?? '',
        userId: data.userId ?? '',
        categoryIds: data.categoryIds ?? [],
        productIds: data.productIds ?? [],
      });
      setFormOpen(true);
    } catch (err) {
      showToast({
        tone: 'error',
        title: isVietnamese ? 'Không tải được chi tiết' : 'Failed to load detail',
        description: err instanceof Error ? err.message : '',
      });
    }
  }

  async function handleSave() {
    if (!form.discountCode.trim() || !form.discountName.trim() || !form.discountValue || !form.startAt || !form.expireDate) {
      showToast({
        tone: 'error',
        title: isVietnamese ? 'Thiếu thông tin bắt buộc' : 'Required fields missing',
        description: isVietnamese ? 'Mã, tên, giá trị và thời gian là bắt buộc.' : 'Code, name, value and dates are required.',
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        discountCode: form.discountCode.toUpperCase().trim(),
        discountName: form.discountName.trim(),
        discountType: form.discountType,
        appliesTo: form.appliesTo,
        discountValue: form.discountValue,
        startAt: new Date(form.startAt).toISOString(),
        expireDate: new Date(form.expireDate).toISOString(),
        isActive: form.isActive,
        usageLimit: form.usageLimit ? Number(form.usageLimit) : undefined,
        minOrderValue: form.minOrderValue || '0',
        maxDiscountAmount: form.maxDiscountAmount || undefined,
        discountDescription: form.discountDescription || undefined,
        userId: form.userId || undefined,
        categoryIds: form.appliesTo === 'category' ? form.categoryIds : undefined,
        productIds: form.appliesTo === 'product' ? form.productIds : undefined,
      };

      if (editTarget) {
        await apiClient.patch(`/discounts/${editTarget.discountId}`, payload);
        showToast({ tone: 'success', title: isVietnamese ? 'Đã cập nhật giảm giá' : 'Discount updated' });
      } else {
        await apiClient.post('/discounts', payload);
        showToast({ tone: 'success', title: isVietnamese ? 'Đã tạo giảm giá mới' : 'Discount created' });
      }

      setFormOpen(false);
      void loadDiscounts();
    } catch (err) {
      showToast({
        tone: 'error',
        title: isVietnamese ? 'Lưu thất bại' : 'Save failed',
        description: err instanceof Error ? err.message : '',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirmDeleteId) return;
    setDeletingId(confirmDeleteId);
    try {
      await apiClient.delete(`/discounts/${confirmDeleteId}`);
      showToast({ tone: 'success', title: isVietnamese ? 'Đã xoá giảm giá' : 'Discount deleted' });
      setConfirmDeleteId(null);
      void loadDiscounts();
    } catch (err) {
      showToast({
        tone: 'error',
        title: isVietnamese ? 'Xoá thất bại' : 'Delete failed',
        description: err instanceof Error ? err.message : '',
      });
    } finally {
      setDeletingId(null);
    }
  }

  async function handleToggleActive(discount: Discount) {
    try {
      await apiClient.patch(`/discounts/${discount.discountId}/toggle-active`);
      showToast({
        tone: 'success',
        title: discount.isActive
          ? isVietnamese ? 'Đã tắt giảm giá' : 'Discount deactivated'
          : isVietnamese ? 'Đã bật giảm giá' : 'Discount activated',
      });
      void loadDiscounts();
    } catch (err) {
      showToast({
        tone: 'error',
        title: isVietnamese ? 'Thao tác thất bại' : 'Action failed',
        description: err instanceof Error ? err.message : '',
      });
    }
  }

  async function openStats(discount: Discount) {
    try {
      const stats = await apiClient.get<{ totalUsage: number; uniqueUsers: number }>(
        `/discounts/admin/${discount.discountId}/stats`,
      );
      setStatsTarget({ ...discount, stats });
    } catch {
      setStatsTarget(discount);
    }
  }

  function toggleCategoryId(id: string) {
    setForm((prev) => ({
      ...prev,
      categoryIds: prev.categoryIds.includes(id)
        ? prev.categoryIds.filter((c) => c !== id)
        : [...prev.categoryIds, id],
    }));
  }

  function toggleProductId(id: string) {
    setForm((prev) => ({
      ...prev,
      productIds: prev.productIds.includes(id)
        ? prev.productIds.filter((p) => p !== id)
        : [...prev.productIds, id],
    }));
  }

  const statusBadge = (d: Discount) => {
    const now = new Date();
    const expired = new Date(d.expireDate) < now;
    const notStarted = new Date(d.startAt) > now;
    if (!d.isActive) return { label: isVietnamese ? 'Tắt' : 'Inactive', cls: 'bg-slate-100 text-slate-500' };
    if (expired) return { label: isVietnamese ? 'Hết hạn' : 'Expired', cls: 'bg-red-50 text-red-600' };
    if (notStarted) return { label: isVietnamese ? 'Chưa bắt đầu' : 'Pending', cls: 'bg-yellow-50 text-yellow-700' };
    return { label: isVietnamese ? 'Đang chạy' : 'Active', cls: 'bg-emerald-50 text-emerald-700' };
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-headline text-[2.7rem] font-black tracking-tight text-primary">
            {isVietnamese ? 'Chương Trình Giảm Giá' : 'Discount Programs'}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-on-surface-variant">
            {isVietnamese
              ? 'Quản lý toàn bộ mã giảm giá: tạo mới, chỉnh sửa, bật/tắt và theo dõi lượt sử dụng.'
              : 'Manage all discount codes: create, edit, toggle and track usage.'}
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="flex shrink-0 items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-black text-white shadow-sm hover:opacity-90"
        >
          <Plus size={18} />
          {isVietnamese ? 'Thêm giảm giá' : 'Add discount'}
        </button>
      </div>

      <section className="rounded-[2.5rem] border border-on-surface-variant/5 bg-white p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-on-surface-variant/5 text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/40">
                <th className="px-4 py-4">{isVietnamese ? 'Mã' : 'Code'}</th>
                <th className="px-4 py-4">{isVietnamese ? 'Tên' : 'Name'}</th>
                <th className="px-4 py-4">{isVietnamese ? 'Giá trị' : 'Value'}</th>
                <th className="px-4 py-4">{isVietnamese ? 'Phạm vi' : 'Scope'}</th>
                <th className="px-4 py-4">{isVietnamese ? 'Thời gian' : 'Period'}</th>
                <th className="px-4 py-4">{isVietnamese ? 'Đã dùng' : 'Used'}</th>
                <th className="px-4 py-4">{isVietnamese ? 'Trạng thái' : 'Status'}</th>
                <th className="px-4 py-4 text-center">{isVietnamese ? 'Thao tác' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-on-surface-variant/5">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-sm text-on-surface-variant">
                    <span className="inline-flex items-center gap-2">
                      <LoaderCircle size={16} className="animate-spin" />
                      {isVietnamese ? 'Đang tải...' : 'Loading...'}
                    </span>
                  </td>
                </tr>
              ) : discounts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <Tags size={30} className="mx-auto text-primary/60" />
                    <p className="mt-3 text-sm font-bold text-on-surface">
                      {isVietnamese ? 'Chưa có mã giảm giá nào' : 'No discounts yet'}
                    </p>
                  </td>
                </tr>
              ) : (
                discounts.map((d) => {
                  const badge = statusBadge(d);
                  return (
                    <tr key={d.discountId} className="hover:bg-on-surface-variant/[0.02]">
                      <td className="px-4 py-4">
                        <span className="rounded-lg bg-primary/10 px-2 py-1 text-xs font-black tracking-wider text-primary">
                          {d.discountCode}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-bold text-on-surface">{d.discountName}</p>
                        {d.discountDescription && (
                          <p className="mt-0.5 text-xs text-on-surface-variant/60 line-clamp-1">{d.discountDescription}</p>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm font-bold text-on-surface">
                        {d.discountType === 'percent' ? `${d.discountValue}%` : `${Number(d.discountValue).toLocaleString()}₫`}
                        {d.maxDiscountAmount && (
                          <p className="text-xs font-normal text-on-surface-variant/60">
                            max {Number(d.maxDiscountAmount).toLocaleString()}₫
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm text-on-surface-variant capitalize">{d.appliesTo}</td>
                      <td className="px-4 py-4 text-xs text-on-surface-variant">
                        <div className="flex items-center gap-1">
                          <CalendarClock size={13} className="shrink-0" />
                          {new Date(d.startAt).toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US')}
                        </div>
                        <div className="mt-1 flex items-center gap-1">
                          <CalendarClock size={13} className="shrink-0 text-red-400" />
                          {new Date(d.expireDate).toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US')}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-on-surface-variant">
                        {d.usedCount}/{d.usageLimit ?? '∞'}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.15em] ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => void openStats(d)}
                            title={isVietnamese ? 'Thống kê' : 'Stats'}
                            className="rounded-xl p-2 text-on-surface-variant hover:bg-primary/5 hover:text-primary"
                          >
                            <BarChart2 size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleToggleActive(d)}
                            title={d.isActive ? (isVietnamese ? 'Tắt' : 'Deactivate') : (isVietnamese ? 'Bật' : 'Activate')}
                            className="rounded-xl p-2 text-on-surface-variant hover:bg-primary/5 hover:text-primary"
                          >
                            {d.isActive ? <ToggleRight size={16} className="text-emerald-500" /> : <ToggleLeft size={16} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => void openEdit(d.discountId)}
                            title={isVietnamese ? 'Sửa' : 'Edit'}
                            className="rounded-xl p-2 text-on-surface-variant hover:bg-primary/5 hover:text-primary"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(d.discountId)}
                            title={isVietnamese ? 'Xoá' : 'Delete'}
                            className="rounded-xl p-2 text-on-surface-variant hover:bg-red-50 hover:text-red-500"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Create / Edit modal */}
      <Modal
        open={formOpen}
        title={editTarget ? (isVietnamese ? 'Sửa giảm giá' : 'Edit discount') : (isVietnamese ? 'Thêm giảm giá' : 'Add discount')}
        onClose={() => setFormOpen(false)}
        size="xl"
        footer={
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setFormOpen(false)} className="rounded-2xl border border-on-surface/10 px-5 py-2.5 text-sm font-bold">
              {isVietnamese ? 'Huỷ' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="flex items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-sm font-black text-white disabled:opacity-60"
            >
              {saving ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />}
              {isVietnamese ? 'Lưu' : 'Save'}
            </button>
          </div>
        }
      >
        <div className="grid gap-5">
          <div className="grid grid-cols-2 gap-4">
            <Field label={isVietnamese ? 'Mã giảm giá *' : 'Discount code *'}>
              <input
                value={form.discountCode}
                onChange={(e) => setForm((p) => ({ ...p, discountCode: e.target.value.toUpperCase() }))}
                className="input-base"
                placeholder="SUMMER20"
              />
            </Field>
            <Field label={isVietnamese ? 'Tên chương trình *' : 'Program name *'}>
              <input
                value={form.discountName}
                onChange={(e) => setForm((p) => ({ ...p, discountName: e.target.value }))}
                className="input-base"
                placeholder={isVietnamese ? 'Giảm hè 2025' : 'Summer Sale 2025'}
              />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Field label={isVietnamese ? 'Loại giảm giá' : 'Discount type'}>
              <select value={form.discountType} onChange={(e) => setForm((p) => ({ ...p, discountType: e.target.value as 'percent' | 'fixed' }))} className="input-base">
                <option value="percent">{isVietnamese ? 'Phần trăm (%)' : 'Percent (%)'}</option>
                <option value="fixed">{isVietnamese ? 'Số tiền cố định' : 'Fixed amount'}</option>
              </select>
            </Field>
            <Field label={isVietnamese ? 'Giá trị *' : 'Value *'}>
              <input
                type="number"
                min="0"
                max={form.discountType === 'percent' ? 100 : undefined}
                value={form.discountValue}
                onChange={(e) => setForm((p) => ({ ...p, discountValue: e.target.value }))}
                className="input-base"
                placeholder={form.discountType === 'percent' ? '20' : '50000'}
              />
            </Field>
            <Field label={isVietnamese ? 'Giảm tối đa' : 'Max discount'}>
              <input
                type="number"
                min="0"
                value={form.maxDiscountAmount}
                onChange={(e) => setForm((p) => ({ ...p, maxDiscountAmount: e.target.value }))}
                className="input-base"
                placeholder={isVietnamese ? 'Không giới hạn' : 'Unlimited'}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label={isVietnamese ? 'Ngày bắt đầu *' : 'Start date *'}>
              <input type="datetime-local" value={form.startAt} onChange={(e) => setForm((p) => ({ ...p, startAt: e.target.value }))} className="input-base" />
            </Field>
            <Field label={isVietnamese ? 'Ngày hết hạn *' : 'Expire date *'}>
              <input type="datetime-local" value={form.expireDate} onChange={(e) => setForm((p) => ({ ...p, expireDate: e.target.value }))} className="input-base" />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Field label={isVietnamese ? 'Đơn hàng tối thiểu' : 'Min order value'}>
              <input type="number" min="0" value={form.minOrderValue} onChange={(e) => setForm((p) => ({ ...p, minOrderValue: e.target.value }))} className="input-base" placeholder="0" />
            </Field>
            <Field label={isVietnamese ? 'Giới hạn lượt dùng' : 'Usage limit'}>
              <input type="number" min="1" value={form.usageLimit} onChange={(e) => setForm((p) => ({ ...p, usageLimit: e.target.value }))} className="input-base" placeholder={isVietnamese ? 'Không giới hạn' : 'Unlimited'} />
            </Field>
            <Field label={isVietnamese ? 'Áp dụng cho' : 'Applies to'}>
              <select value={form.appliesTo} onChange={(e) => setForm((p) => ({ ...p, appliesTo: e.target.value as 'order' | 'category' | 'product' }))} className="input-base">
                <option value="order">{isVietnamese ? 'Toàn bộ đơn hàng' : 'Entire order'}</option>
                <option value="category">{isVietnamese ? 'Theo danh mục' : 'By category'}</option>
                <option value="product">{isVietnamese ? 'Theo sản phẩm' : 'By product'}</option>
              </select>
            </Field>
          </div>

          {form.appliesTo === 'category' && (
            <Field label={isVietnamese ? 'Chọn danh mục áp dụng' : 'Select categories'}>
              <div className="max-h-40 overflow-y-auto rounded-2xl border border-on-surface/10 bg-surface p-3 grid grid-cols-2 gap-2">
                {categories.map((cat) => (
                  <label key={cat.categoryId} className="flex items-center gap-2 cursor-pointer text-sm">
                    <input type="checkbox" checked={form.categoryIds.includes(cat.categoryId)} onChange={() => toggleCategoryId(cat.categoryId)} className="accent-primary" />
                    {cat.categoryName}
                  </label>
                ))}
              </div>
            </Field>
          )}

          {form.appliesTo === 'product' && (
            <Field label={isVietnamese ? 'Chọn sản phẩm áp dụng' : 'Select products'}>
              <div className="max-h-48 overflow-y-auto rounded-2xl border border-on-surface/10 bg-surface p-3 grid grid-cols-1 gap-2">
                {products.map((prod) => (
                  <label key={prod.productId} className="flex items-center gap-2 cursor-pointer text-sm">
                    <input type="checkbox" checked={form.productIds.includes(prod.productId)} onChange={() => toggleProductId(prod.productId)} className="accent-primary" />
                    {prod.productName}
                  </label>
                ))}
              </div>
            </Field>
          )}

          <Field label={isVietnamese ? 'Mô tả' : 'Description'}>
            <textarea
              value={form.discountDescription}
              onChange={(e) => setForm((p) => ({ ...p, discountDescription: e.target.value }))}
              rows={2}
              className="input-base resize-none"
              placeholder={isVietnamese ? 'Mô tả ngắn về chương trình...' : 'Short description...'}
            />
          </Field>

          <div className="flex items-center gap-3">
            <input id="isActive" type="checkbox" checked={form.isActive} onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))} className="accent-primary h-4 w-4" />
            <label htmlFor="isActive" className="text-sm font-bold text-on-surface cursor-pointer">
              {isVietnamese ? 'Kích hoạt ngay sau khi tạo' : 'Active immediately after creation'}
            </label>
          </div>
        </div>
      </Modal>

      {/* Confirm delete modal */}
      <Modal
        open={!!confirmDeleteId}
        title={isVietnamese ? 'Xác nhận xoá' : 'Confirm delete'}
        onClose={() => setConfirmDeleteId(null)}
        size="md"
        footer={
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setConfirmDeleteId(null)} className="rounded-2xl border border-on-surface/10 px-5 py-2.5 text-sm font-bold">
              {isVietnamese ? 'Huỷ' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={!!deletingId}
              className="flex items-center gap-2 rounded-2xl bg-red-500 px-5 py-2.5 text-sm font-black text-white disabled:opacity-60"
            >
              {deletingId ? <LoaderCircle size={16} className="animate-spin" /> : <Trash2 size={16} />}
              {isVietnamese ? 'Xoá' : 'Delete'}
            </button>
          </div>
        }
      >
        <p className="text-sm text-on-surface-variant">
          {isVietnamese
            ? 'Bạn có chắc muốn xoá mã giảm giá này? Thao tác không thể hoàn tác.'
            : 'Are you sure you want to delete this discount? This action cannot be undone.'}
        </p>
      </Modal>

      {/* Stats modal */}
      <Modal
        open={!!statsTarget}
        title={isVietnamese ? 'Thống kê sử dụng' : 'Usage Statistics'}
        onClose={() => setStatsTarget(null)}
        size="md"
      >
        {statsTarget && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-primary/5 px-5 py-4 text-center">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60">{isVietnamese ? 'Mã giảm giá' : 'Discount code'}</p>
              <p className="mt-1 text-2xl font-black text-primary">{statsTarget.discountCode}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl border border-on-surface-variant/5 bg-surface px-5 py-4 text-center">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50">{isVietnamese ? 'Tổng lượt dùng' : 'Total uses'}</p>
                <p className="mt-2 text-3xl font-black text-on-surface">{statsTarget.stats?.totalUsage ?? statsTarget.usedCount}</p>
                <p className="mt-1 text-xs text-on-surface-variant/60">/ {statsTarget.usageLimit ?? '∞'}</p>
              </div>
              <div className="rounded-2xl border border-on-surface-variant/5 bg-surface px-5 py-4 text-center">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50">{isVietnamese ? 'Người dùng' : 'Unique users'}</p>
                <p className="mt-2 text-3xl font-black text-on-surface">{statsTarget.stats?.uniqueUsers ?? '—'}</p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2">
      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50">{label}</span>
      {children}
    </label>
  );
}
import { type ReactNode } from 'react';
