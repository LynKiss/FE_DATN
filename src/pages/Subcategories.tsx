import { useCallback, useEffect, useState } from 'react';
import { Edit2, FolderOpen, LoaderCircle, Plus, Save, Search, Trash2 } from 'lucide-react';
import { apiClient } from '../lib/api';
import { useLanguage } from '../i18n/language-context';
import { useToast } from '../hooks/useToast';
import Modal from '../components/shared/Modal';
import Pagination from '../components/shared/Pagination';

type Subcategory = {
  subcategoryId: string;
  categoryId: string;
  subcategoryName: string;
  subcategorySlug: string;
  isActive: boolean;
  createdAt: string;
};

type Category = { categoryId: string; categoryName: string };
type Meta = { page: number; limit: number; total: number; totalPages: number };
type FormState = { categoryId: string; subcategoryName: string; subcategorySlug: string; isActive: boolean };
const defaultForm: FormState = { categoryId: '', subcategoryName: '', subcategorySlug: '', isActive: true };

export default function Subcategories() {
  const { language } = useLanguage();
  const isVietnamese = language === 'vi';
  const { showToast } = useToast();

  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [meta, setMeta] = useState<Meta>({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Subcategory | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    async function loadCategories() {
      try {
        const data = await apiClient.get<{ items: Category[] }>('/categories?limit=200');
        setCategories(data.items ?? []);
      } catch { /* silently fail */ }
    }
    void loadCategories();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ page: String(page), limit: '20' });
      if (search.trim()) query.set('search', search.trim());
      if (filterCategory) query.set('categoryId', filterCategory);
      const data = await apiClient.get<{ items: Subcategory[]; meta: Meta }>(
        `/subcategories?${query.toString()}`,
      );
      setSubcategories(data.items);
      setMeta(data.meta);
    } catch (err) {
      showToast({ tone: 'error', title: isVietnamese ? 'Lỗi tải danh sách' : 'Failed to load', description: err instanceof Error ? err.message : '' });
    } finally {
      setLoading(false);
    }
  }, [page, search, filterCategory, isVietnamese, showToast]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, filterCategory]);

  function openCreate() {
    setEditTarget(null);
    setForm(defaultForm);
    setFormOpen(true);
  }

  function openEdit(sub: Subcategory) {
    setEditTarget(sub);
    setForm({ categoryId: sub.categoryId, subcategoryName: sub.subcategoryName, subcategorySlug: sub.subcategorySlug, isActive: sub.isActive });
    setFormOpen(true);
  }

  async function handleSave() {
    if (!form.categoryId || !form.subcategoryName.trim()) {
      showToast({ tone: 'error', title: isVietnamese ? 'Thiếu thông tin bắt buộc' : 'Required fields missing' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        categoryId: form.categoryId,
        subcategoryName: form.subcategoryName.trim(),
        subcategorySlug: form.subcategorySlug.trim() || undefined,
        isActive: form.isActive,
      };
      if (editTarget) {
        await apiClient.patch(`/subcategories/${editTarget.subcategoryId}`, payload);
        showToast({ tone: 'success', title: isVietnamese ? 'Đã cập nhật danh mục phụ' : 'Subcategory updated' });
      } else {
        await apiClient.post('/subcategories', payload);
        showToast({ tone: 'success', title: isVietnamese ? 'Đã tạo danh mục phụ' : 'Subcategory created' });
      }
      setFormOpen(false);
      void load();
    } catch (err) {
      showToast({ tone: 'error', title: isVietnamese ? 'Lưu thất bại' : 'Save failed', description: err instanceof Error ? err.message : '' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirmDeleteId) return;
    setDeletingId(confirmDeleteId);
    try {
      await apiClient.delete(`/subcategories/${confirmDeleteId}`);
      showToast({ tone: 'success', title: isVietnamese ? 'Đã xoá danh mục phụ' : 'Subcategory deleted' });
      setConfirmDeleteId(null);
      void load();
    } catch (err) {
      showToast({ tone: 'error', title: isVietnamese ? 'Xoá thất bại' : 'Delete failed', description: err instanceof Error ? err.message : '' });
    } finally {
      setDeletingId(null);
    }
  }

  const categoryName = (id: string) => categories.find((c) => c.categoryId === id)?.categoryName ?? id;

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-headline text-[2.7rem] font-black tracking-tight text-primary">
            {isVietnamese ? 'Danh Mục Phụ' : 'Subcategories'}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-on-surface-variant">
            {isVietnamese ? 'Quản lý danh mục phụ trong từng danh mục chính.' : 'Manage subcategories within each main category.'}
          </p>
        </div>
        <button type="button" onClick={openCreate} className="flex shrink-0 items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-black text-white shadow-sm hover:opacity-90">
          <Plus size={18} />
          {isVietnamese ? 'Thêm danh mục phụ' : 'Add subcategory'}
        </button>
      </div>

      <section className="rounded-xl border border-on-surface-variant/5 bg-white p-6 shadow-sm space-y-5">
        <div className="grid gap-4 md:grid-cols-[1fr_240px]">
          <div className="relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} className="w-full rounded-2xl border border-on-surface/10 bg-surface py-3 pl-10 pr-4 text-sm outline-none" placeholder={isVietnamese ? 'Tìm danh mục phụ...' : 'Search subcategories...'} />
          </div>
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none">
            <option value="">{isVietnamese ? 'Tất cả danh mục' : 'All categories'}</option>
            {categories.map((c) => <option key={c.categoryId} value={c.categoryId}>{c.categoryName}</option>)}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-on-surface-variant/5 text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/40">
                <th className="px-4 py-4">{isVietnamese ? 'Tên danh mục phụ' : 'Subcategory name'}</th>
                <th className="px-4 py-4">{isVietnamese ? 'Slug' : 'Slug'}</th>
                <th className="px-4 py-4">{isVietnamese ? 'Danh mục cha' : 'Parent category'}</th>
                <th className="px-4 py-4">{isVietnamese ? 'Trạng thái' : 'Status'}</th>
                <th className="px-4 py-4 text-center">{isVietnamese ? 'Thao tác' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-on-surface-variant/5">
              {loading ? (
                <tr><td colSpan={5} className="py-16 text-center"><LoaderCircle size={18} className="mx-auto animate-spin text-on-surface-variant/40" /></td></tr>
              ) : subcategories.length === 0 ? (
                <tr><td colSpan={5} className="py-16 text-center">
                  <FolderOpen size={30} className="mx-auto text-primary/40" />
                  <p className="mt-3 text-sm font-bold text-on-surface">{isVietnamese ? 'Chưa có danh mục phụ' : 'No subcategories yet'}</p>
                </td></tr>
              ) : (
                subcategories.map((sub) => (
                  <tr key={sub.subcategoryId} className="hover:bg-on-surface-variant/[0.02]">
                    <td className="px-4 py-4 font-bold text-on-surface">{sub.subcategoryName}</td>
                    <td className="px-4 py-4 text-sm font-mono text-on-surface-variant/60">{sub.subcategorySlug}</td>
                    <td className="px-4 py-4 text-sm text-on-surface-variant">{categoryName(sub.categoryId)}</td>
                    <td className="px-4 py-4">
                      <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.15em] ${sub.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {sub.isActive ? (isVietnamese ? 'Bật' : 'Active') : (isVietnamese ? 'Tắt' : 'Inactive')}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-center gap-1">
                        <button type="button" onClick={() => openEdit(sub)} className="rounded-xl p-2 text-on-surface-variant hover:bg-primary/5 hover:text-primary"><Edit2 size={16} /></button>
                        <button type="button" onClick={() => setConfirmDeleteId(sub.subcategoryId)} className="rounded-xl p-2 text-on-surface-variant hover:bg-red-50 hover:text-red-500"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={meta.page} limit={meta.limit} total={meta.total} totalPages={meta.totalPages} isVietnamese={isVietnamese} onPageChange={setPage} onLimitChange={() => {}} />
      </section>

      <Modal open={formOpen} title={editTarget ? (isVietnamese ? 'Sửa danh mục phụ' : 'Edit subcategory') : (isVietnamese ? 'Thêm danh mục phụ' : 'Add subcategory')} onClose={() => setFormOpen(false)} size="md"
        footer={
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setFormOpen(false)} className="rounded-2xl border border-on-surface/10 px-5 py-2.5 text-sm font-bold">{isVietnamese ? 'Huỷ' : 'Cancel'}</button>
            <button type="button" onClick={() => void handleSave()} disabled={saving} className="flex items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-sm font-black text-white disabled:opacity-60">
              {saving ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />}
              {isVietnamese ? 'Lưu' : 'Save'}
            </button>
          </div>
        }
      >
        <div className="grid gap-4">
          <label className="grid gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50">{isVietnamese ? 'Danh mục cha *' : 'Parent category *'}</span>
            <select value={form.categoryId} onChange={(e) => setForm((p) => ({ ...p, categoryId: e.target.value }))} className="input-base">
              <option value="">{isVietnamese ? 'Chọn danh mục cha...' : 'Select parent category...'}</option>
              {categories.map((c) => <option key={c.categoryId} value={c.categoryId}>{c.categoryName}</option>)}
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50">{isVietnamese ? 'Tên danh mục phụ *' : 'Subcategory name *'}</span>
            <input value={form.subcategoryName} onChange={(e) => setForm((p) => ({ ...p, subcategoryName: e.target.value }))} className="input-base" placeholder={isVietnamese ? 'VD: Rau củ hữu cơ' : 'e.g., Organic Vegetables'} />
          </label>
          <label className="grid gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50">Slug</span>
            <input value={form.subcategorySlug} onChange={(e) => setForm((p) => ({ ...p, subcategorySlug: e.target.value }))} className="input-base" placeholder={isVietnamese ? 'Tự động nếu để trống' : 'Auto-generated if empty'} />
          </label>
          <div className="flex items-center gap-3">
            <input id="subIsActive" type="checkbox" checked={form.isActive} onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))} className="accent-primary h-4 w-4" />
            <label htmlFor="subIsActive" className="text-sm font-bold text-on-surface cursor-pointer">{isVietnamese ? 'Kích hoạt' : 'Active'}</label>
          </div>
        </div>
      </Modal>

      <Modal open={!!confirmDeleteId} title={isVietnamese ? 'Xác nhận xoá' : 'Confirm delete'} onClose={() => setConfirmDeleteId(null)} size="md"
        footer={
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setConfirmDeleteId(null)} className="rounded-2xl border border-on-surface/10 px-5 py-2.5 text-sm font-bold">{isVietnamese ? 'Huỷ' : 'Cancel'}</button>
            <button type="button" onClick={() => void handleDelete()} disabled={!!deletingId} className="flex items-center gap-2 rounded-2xl bg-red-500 px-5 py-2.5 text-sm font-black text-white disabled:opacity-60">
              {deletingId ? <LoaderCircle size={16} className="animate-spin" /> : <Trash2 size={16} />}
              {isVietnamese ? 'Xoá' : 'Delete'}
            </button>
          </div>
        }
      >
        <p className="text-sm text-on-surface-variant">{isVietnamese ? 'Bạn có chắc muốn xoá danh mục phụ này?' : 'Are you sure you want to delete this subcategory?'}</p>
      </Modal>
    </div>
  );
}
