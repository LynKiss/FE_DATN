import { useCallback, useEffect, useState } from 'react';
import { Edit2, Globe, LoaderCircle, Plus, Save, Search, Trash2 } from 'lucide-react';
import { apiClient } from '../lib/api';
import { useLanguage } from '../i18n/language-context';
import { useToast } from '../hooks/useToast';
import Modal from '../components/shared/Modal';
import Pagination from '../components/shared/Pagination';

type Origin = {
  originId: string;
  originName: string;
  originImage: string | null;
  createdAt: string;
};

type OriginMeta = { page: number; limit: number; total: number; totalPages: number };

type FormState = { originName: string; originImage: string };
const defaultForm: FormState = { originName: '', originImage: '' };

export default function Origins() {
  const { language } = useLanguage();
  const isVietnamese = language === 'vi';
  const { showToast } = useToast();

  const [origins, setOrigins] = useState<Origin[]>([]);
  const [meta, setMeta] = useState<OriginMeta>({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Origin | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ page: String(page), limit: '20' });
      if (search.trim()) query.set('search', search.trim());
      const data = await apiClient.get<{ items: Origin[]; meta: OriginMeta }>(
        `/origins?${query.toString()}`,
      );
      setOrigins(data.items);
      setMeta(data.meta);
    } catch (err) {
      showToast({
        tone: 'error',
        title: isVietnamese ? 'Lỗi tải danh sách' : 'Failed to load origins',
        description: err instanceof Error ? err.message : '',
      });
    } finally {
      setLoading(false);
    }
  }, [page, search, isVietnamese, showToast]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setPage(1); }, [search]);

  function openCreate() {
    setEditTarget(null);
    setForm(defaultForm);
    setFormOpen(true);
  }

  function openEdit(origin: Origin) {
    setEditTarget(origin);
    setForm({ originName: origin.originName, originImage: origin.originImage ?? '' });
    setFormOpen(true);
  }

  async function handleSave() {
    if (!form.originName.trim()) {
      showToast({
        tone: 'error',
        title: isVietnamese ? 'Tên xuất xứ không được để trống' : 'Origin name is required',
      });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        originName: form.originName.trim(),
        originImage: form.originImage.trim() || undefined,
      };
      if (editTarget) {
        await apiClient.patch(`/origins/${editTarget.originId}`, payload);
        showToast({ tone: 'success', title: isVietnamese ? 'Đã cập nhật xuất xứ' : 'Origin updated' });
      } else {
        await apiClient.post('/origins', payload);
        showToast({ tone: 'success', title: isVietnamese ? 'Đã tạo xuất xứ mới' : 'Origin created' });
      }
      setFormOpen(false);
      void load();
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
      await apiClient.delete(`/origins/${confirmDeleteId}`);
      showToast({ tone: 'success', title: isVietnamese ? 'Đã xoá xuất xứ' : 'Origin deleted' });
      setConfirmDeleteId(null);
      void load();
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

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-headline text-[2.7rem] font-black tracking-tight text-primary">
            {isVietnamese ? 'Quản Lý Xuất Xứ' : 'Origin Management'}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-on-surface-variant">
            {isVietnamese
              ? 'Quản lý danh sách xuất xứ sản phẩm (Việt Nam, Nhật Bản, Hàn Quốc...).'
              : 'Manage product origins (Vietnam, Japan, Korea...).'}
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="flex shrink-0 items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-black text-white shadow-sm hover:opacity-90"
        >
          <Plus size={18} />
          {isVietnamese ? 'Thêm xuất xứ' : 'Add origin'}
        </button>
      </div>

      <section className="rounded-xl border border-on-surface-variant/5 bg-white p-6 shadow-sm space-y-5">
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-sm rounded-2xl border border-on-surface/10 bg-surface py-3 pl-10 pr-4 text-sm outline-none"
            placeholder={isVietnamese ? 'Tìm xuất xứ...' : 'Search origins...'}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-on-surface-variant/5 text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/40">
                <th className="px-4 py-4">{isVietnamese ? 'Hình ảnh' : 'Image'}</th>
                <th className="px-4 py-4">{isVietnamese ? 'Tên xuất xứ' : 'Origin name'}</th>
                <th className="px-4 py-4">{isVietnamese ? 'Ngày tạo' : 'Created'}</th>
                <th className="px-4 py-4 text-center">{isVietnamese ? 'Thao tác' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-on-surface-variant/5">
              {loading ? (
                <tr>
                  <td colSpan={4} className="py-16 text-center text-sm text-on-surface-variant">
                    <LoaderCircle size={18} className="mx-auto animate-spin" />
                  </td>
                </tr>
              ) : origins.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-16 text-center">
                    <Globe size={30} className="mx-auto text-primary/40" />
                    <p className="mt-3 text-sm font-bold text-on-surface">
                      {isVietnamese ? 'Chưa có xuất xứ nào' : 'No origins yet'}
                    </p>
                  </td>
                </tr>
              ) : (
                origins.map((o) => (
                  <tr key={o.originId} className="hover:bg-on-surface-variant/[0.02]">
                    <td className="px-4 py-4">
                      {o.originImage ? (
                        <img src={o.originImage} alt={o.originName} className="h-10 w-10 rounded-xl object-cover" />
                      ) : (
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                          <Globe size={18} className="text-primary/50" />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 font-bold text-on-surface">{o.originName}</td>
                    <td className="px-4 py-4 text-sm text-on-surface-variant">
                      {new Date(o.createdAt).toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US')}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-center gap-1">
                        <button type="button" onClick={() => openEdit(o)} className="rounded-xl p-2 text-on-surface-variant hover:bg-primary/5 hover:text-primary">
                          <Edit2 size={16} />
                        </button>
                        <button type="button" onClick={() => setConfirmDeleteId(o.originId)} className="rounded-xl p-2 text-on-surface-variant hover:bg-red-50 hover:text-red-500">
                          <Trash2 size={16} />
                        </button>
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

      <Modal
        open={formOpen}
        title={editTarget ? (isVietnamese ? 'Sửa xuất xứ' : 'Edit origin') : (isVietnamese ? 'Thêm xuất xứ' : 'Add origin')}
        onClose={() => setFormOpen(false)}
        size="md"
        footer={
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setFormOpen(false)} className="rounded-2xl border border-on-surface/10 px-5 py-2.5 text-sm font-bold">
              {isVietnamese ? 'Huỷ' : 'Cancel'}
            </button>
            <button type="button" onClick={() => void handleSave()} disabled={saving} className="flex items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-sm font-black text-white disabled:opacity-60">
              {saving ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />}
              {isVietnamese ? 'Lưu' : 'Save'}
            </button>
          </div>
        }
      >
        <div className="grid gap-4">
          <label className="grid gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50">
              {isVietnamese ? 'Tên xuất xứ *' : 'Origin name *'}
            </span>
            <input value={form.originName} onChange={(e) => setForm((p) => ({ ...p, originName: e.target.value }))} className="input-base" placeholder="Việt Nam" />
          </label>
          <label className="grid gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50">
              {isVietnamese ? 'URL hình ảnh (quốc kỳ...)' : 'Image URL (flag...)'}
            </span>
            <input value={form.originImage} onChange={(e) => setForm((p) => ({ ...p, originImage: e.target.value }))} className="input-base" placeholder="https://..." />
            {form.originImage && <img src={form.originImage} alt="" className="h-12 w-12 rounded-xl object-cover" />}
          </label>
        </div>
      </Modal>

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
            <button type="button" onClick={() => void handleDelete()} disabled={!!deletingId} className="flex items-center gap-2 rounded-2xl bg-red-500 px-5 py-2.5 text-sm font-black text-white disabled:opacity-60">
              {deletingId ? <LoaderCircle size={16} className="animate-spin" /> : <Trash2 size={16} />}
              {isVietnamese ? 'Xoá' : 'Delete'}
            </button>
          </div>
        }
      >
        <p className="text-sm text-on-surface-variant">
          {isVietnamese ? 'Xoá xuất xứ này sẽ ảnh hưởng đến sản phẩm đang dùng nó.' : 'Deleting this origin may affect products using it.'}
        </p>
      </Modal>
    </div>
  );
}
