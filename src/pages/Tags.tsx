import { useCallback, useEffect, useState } from 'react';
import { Edit2, Hash, LoaderCircle, Plus, Save, Search, Trash2 } from 'lucide-react';
import { apiClient } from '../lib/api';
import { useLanguage } from '../i18n/language-context';
import { useToast } from '../hooks/useToast';
import Modal from '../components/shared/Modal';

type Tag = { tagId: string; tagName: string; createdAt: string };
type FormState = { tagName: string };
const defaultForm: FormState = { tagName: '' };

export default function Tags() {
  const { language } = useLanguage();
  const isVietnamese = language === 'vi';
  const { showToast } = useToast();

  const [tags, setTags] = useState<Tag[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Tag | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
      const data = await apiClient.get<Tag[]>(`/tags${query}`);
      setTags(data);
    } catch (err) {
      showToast({ tone: 'error', title: isVietnamese ? 'Lỗi tải tags' : 'Failed to load tags', description: err instanceof Error ? err.message : '' });
    } finally {
      setLoading(false);
    }
  }, [search, isVietnamese, showToast]);

  useEffect(() => { void load(); }, [load]);

  function openCreate() {
    setEditTarget(null);
    setForm(defaultForm);
    setFormOpen(true);
  }

  function openEdit(tag: Tag) {
    setEditTarget(tag);
    setForm({ tagName: tag.tagName });
    setFormOpen(true);
  }

  async function handleSave() {
    if (!form.tagName.trim()) {
      showToast({ tone: 'error', title: isVietnamese ? 'Tên tag không được để trống' : 'Tag name is required' });
      return;
    }
    setSaving(true);
    try {
      if (editTarget) {
        await apiClient.patch(`/tags/${editTarget.tagId}`, { tagName: form.tagName.trim() });
        showToast({ tone: 'success', title: isVietnamese ? 'Đã cập nhật tag' : 'Tag updated' });
      } else {
        await apiClient.post('/tags', { tagName: form.tagName.trim() });
        showToast({ tone: 'success', title: isVietnamese ? 'Đã tạo tag mới' : 'Tag created' });
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
      await apiClient.delete(`/tags/${confirmDeleteId}`);
      showToast({ tone: 'success', title: isVietnamese ? 'Đã xoá tag' : 'Tag deleted' });
      setConfirmDeleteId(null);
      void load();
    } catch (err) {
      showToast({ tone: 'error', title: isVietnamese ? 'Xoá thất bại' : 'Delete failed', description: err instanceof Error ? err.message : '' });
    } finally {
      setDeletingId(null);
    }
  }

  const filtered = tags.filter((t) => t.tagName.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-headline text-[2.7rem] font-black tracking-tight text-primary">
            {isVietnamese ? 'Quản Lý Tag' : 'Tag Management'}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-on-surface-variant">
            {isVietnamese
              ? 'Quản lý tag để phân loại và tìm kiếm sản phẩm nhanh hơn.'
              : 'Manage tags to classify and search products more efficiently.'}
          </p>
        </div>
        <button type="button" onClick={openCreate} className="flex shrink-0 items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-black text-white shadow-sm hover:opacity-90">
          <Plus size={18} />
          {isVietnamese ? 'Thêm tag' : 'Add tag'}
        </button>
      </div>

      <section className="rounded-xl border border-on-surface-variant/5 bg-white p-6 shadow-sm space-y-5">
        <div className="relative max-w-sm">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} className="w-full rounded-2xl border border-on-surface/10 bg-surface py-3 pl-10 pr-4 text-sm outline-none" placeholder={isVietnamese ? 'Tìm tag...' : 'Search tags...'} />
        </div>

        {loading ? (
          <div className="py-16 text-center"><LoaderCircle size={22} className="mx-auto animate-spin text-primary/40" /></div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Hash size={30} className="mx-auto text-primary/40" />
            <p className="mt-3 text-sm font-bold text-on-surface">{isVietnamese ? 'Chưa có tag nào' : 'No tags yet'}</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            {filtered.map((tag) => (
              <div key={tag.tagId} className="group flex items-center gap-2 rounded-2xl border border-on-surface-variant/10 bg-surface px-4 py-2.5">
                <Hash size={14} className="text-primary/60" />
                <span className="text-sm font-bold text-on-surface">{tag.tagName}</span>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button type="button" onClick={() => openEdit(tag)} className="rounded-lg p-1 text-on-surface-variant hover:text-primary"><Edit2 size={13} /></button>
                  <button type="button" onClick={() => setConfirmDeleteId(tag.tagId)} className="rounded-lg p-1 text-on-surface-variant hover:text-red-500"><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && (
          <p className="text-xs text-on-surface-variant/50">
            {isVietnamese ? `${filtered.length} tag` : `${filtered.length} tag${filtered.length !== 1 ? 's' : ''}`}
          </p>
        )}
      </section>

      <Modal open={formOpen} title={editTarget ? (isVietnamese ? 'Sửa tag' : 'Edit tag') : (isVietnamese ? 'Thêm tag mới' : 'Add new tag')} onClose={() => setFormOpen(false)} size="md"
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
        <label className="grid gap-2">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/50">{isVietnamese ? 'Tên tag *' : 'Tag name *'}</span>
          <input value={form.tagName} onChange={(e) => setForm({ tagName: e.target.value })} className="input-base" placeholder={isVietnamese ? 'VD: hữu cơ, tươi sạch...' : 'e.g., organic, fresh...'} autoFocus />
        </label>
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
        <p className="text-sm text-on-surface-variant">
          {isVietnamese ? 'Xoá tag sẽ gỡ nó khỏi tất cả sản phẩm đang gắn.' : 'Deleting this tag will remove it from all products.'}
        </p>
      </Modal>
    </div>
  );
}
