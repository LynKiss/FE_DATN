import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  MapPin,
  Plus,
  Edit2,
  Trash2,
  Star,
  LoaderCircle,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Home,
  Phone,
  User,
} from 'lucide-react';
import { clientApi } from '../../lib/client-api';
import { useClientSession } from '../../hooks/useClientSession';

type Province = { code: number; name: string };
type District = { code: number; name: string };
type Ward = { code: number; name: string };

type Address = {
  id: string;
  recipientName: string;
  phone: string;
  addressLine: string;
  ward?: string;
  district?: string;
  province?: string;
  isDefault: boolean;
};

type FormState = {
  recipientName: string;
  phone: string;
  addressLine: string;
  ward: string;
  district: string;
  province: string;
  isDefault: boolean;
};

const defaultForm: FormState = {
  recipientName: '',
  phone: '',
  addressLine: '',
  ward: '',
  district: '',
  province: '',
  isDefault: false,
};

export default function Addresses() {
  const navigate = useNavigate();
  const { session } = useClientSession();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Address | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<Partial<FormState>>({});

  const [deleteTarget, setDeleteTarget] = useState<Address | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);

  // Cascading address data
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingWards, setLoadingWards] = useState(false);
  const provincesCache = useRef<Province[] | null>(null);

  useEffect(() => {
    if (!session) {
      void navigate('/client/login');
      return;
    }
    void loadAddresses();
  }, [session]);

  async function loadAddresses() {
    setLoading(true);
    try {
      const data = await clientApi.get<Address[]>('/users/me/addresses');
      setAddresses(data);
    } catch {
      showToast('error', 'Không tải được danh sách địa chỉ');
    } finally {
      setLoading(false);
    }
  }

  function showToast(type: 'success' | 'error', msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  }

  async function fetchProvinces() {
    if (provincesCache.current) {
      setProvinces(provincesCache.current);
      return;
    }
    setLoadingProvinces(true);
    try {
      const res = await fetch('https://provinces.open-api.vn/api/?depth=1');
      const data = (await res.json()) as Province[];
      provincesCache.current = data;
      setProvinces(data);
    } catch {
      setProvinces([]);
    } finally {
      setLoadingProvinces(false);
    }
  }

  async function fetchDistricts(provinceCode: number) {
    setLoadingDistricts(true);
    setDistricts([]);
    setWards([]);
    try {
      const res = await fetch(
        `https://provinces.open-api.vn/api/p/${provinceCode}?depth=2`,
      );
      const data = (await res.json()) as { name: string; districts: District[] };
      setDistricts(data.districts ?? []);
    } catch {
      setDistricts([]);
    } finally {
      setLoadingDistricts(false);
    }
  }

  async function fetchWards(districtCode: number) {
    setLoadingWards(true);
    setWards([]);
    try {
      const res = await fetch(
        `https://provinces.open-api.vn/api/d/${districtCode}?depth=2`,
      );
      const data = (await res.json()) as { name: string; wards: Ward[] };
      setWards(data.wards ?? []);
    } catch {
      setWards([]);
    } finally {
      setLoadingWards(false);
    }
  }

  function openCreate() {
    setEditTarget(null);
    setForm({ ...defaultForm, isDefault: addresses.length === 0 });
    setFormErrors({});
    setDistricts([]);
    setWards([]);
    void fetchProvinces();
    setFormOpen(true);
  }

  function openEdit(addr: Address) {
    setEditTarget(addr);
    setForm({
      recipientName: addr.recipientName,
      phone: addr.phone,
      addressLine: addr.addressLine,
      ward: addr.ward ?? '',
      district: addr.district ?? '',
      province: addr.province ?? '',
      isDefault: addr.isDefault,
    });
    setFormErrors({});
    setDistricts([]);
    setWards([]);
    void fetchProvinces();
    setFormOpen(true);
  }

  function validate(): boolean {
    const errors: Partial<FormState> = {};
    if (!form.recipientName.trim()) errors.recipientName = 'Vui lòng nhập họ tên';
    if (!form.phone.trim()) errors.phone = 'Vui lòng nhập số điện thoại';
    else if (!/^[0-9]{8,15}$/.test(form.phone.trim())) errors.phone = 'Số điện thoại không hợp lệ';
    if (!form.addressLine.trim()) errors.addressLine = 'Vui lòng nhập địa chỉ';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        recipientName: form.recipientName.trim(),
        phone: form.phone.trim(),
        addressLine: form.addressLine.trim(),
        ward: form.ward.trim() || undefined,
        district: form.district.trim() || undefined,
        province: form.province.trim() || undefined,
        isDefault: form.isDefault,
      };
      if (editTarget) {
        await clientApi.patch(`/users/me/addresses/${editTarget.id}`, payload);
        showToast('success', 'Đã cập nhật địa chỉ');
      } else {
        await clientApi.post('/users/me/addresses', payload);
        showToast('success', 'Đã thêm địa chỉ mới');
      }
      setFormOpen(false);
      await loadAddresses();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Lưu thất bại');
    } finally {
      setSaving(false);
    }
  }

  async function handleSetDefault(id: string) {
    setSettingDefaultId(id);
    try {
      await clientApi.patch(`/users/me/addresses/${id}/default`, {});
      showToast('success', 'Đã đặt làm địa chỉ mặc định');
      await loadAddresses();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Thao tác thất bại');
    } finally {
      setSettingDefaultId(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await clientApi.delete(`/users/me/addresses/${deleteTarget.id}`);
      showToast('success', 'Đã xóa địa chỉ');
      setDeleteTarget(null);
      await loadAddresses();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Xóa thất bại');
    } finally {
      setDeleting(false);
    }
  }

  function formatAddress(addr: Address) {
    return [addr.addressLine, addr.ward, addr.district, addr.province]
      .filter(Boolean)
      .join(', ');
  }

  return (
    <div className="client-surface min-h-[80vh]">
      <div className="mx-auto max-w-3xl px-4 py-10 lg:px-6">
        {/* Back */}
        <Link
          to="/client/account"
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-[#006241] hover:underline"
        >
          <ArrowLeft size={15} />
          Quay lại tài khoản
        </Link>

        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em]" style={{ color: '#006241' }}>
              Địa chỉ
            </p>
            <h1 className="mt-1 text-3xl font-black text-[#1E3932]">Địa chỉ giao hàng</h1>
            <p className="mt-1 text-sm text-gray-500">
              Quản lý các địa chỉ nhận hàng của bạn
            </p>
          </div>
          <button
            onClick={openCreate}
            className="client-pill-primary flex items-center gap-2 px-5 py-3 text-sm font-bold"
          >
            <Plus size={15} />
            Thêm địa chỉ
          </button>
        </div>

        {toast && (
          <div
            className={`mb-4 flex items-center gap-2.5 rounded-xl p-3.5 text-sm ${
              toast.type === 'success' ? 'bg-[#d4e9e2] text-[#1E3932]' : 'bg-red-50 text-red-700'
            }`}
          >
            {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            {toast.msg}
          </div>
        )}

        {loading ? (
          <div className="flex min-h-48 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#006241] border-t-transparent" />
          </div>
        ) : addresses.length === 0 ? (
          <div className="client-card p-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full" style={{ background: '#d4e9e2' }}>
              <MapPin size={28} style={{ color: '#006241' }} />
            </div>
            <p className="font-bold text-[#1E3932]">Chưa có địa chỉ nào</p>
            <p className="mt-1 text-sm text-gray-400">Thêm địa chỉ để đặt hàng nhanh hơn</p>
            <button
              onClick={openCreate}
              className="client-pill-primary mx-auto mt-5 flex items-center gap-2 px-6 py-3 text-sm font-bold"
            >
              <Plus size={15} /> Thêm địa chỉ đầu tiên
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {addresses.map((addr) => (
              <div
                key={addr.id}
                className={`client-card border-2 p-5 transition ${
                  addr.isDefault ? 'border-[#006241]' : 'border-transparent'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      {addr.isDefault && (
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold"
                          style={{ background: '#d4e9e2', color: '#006241' }}
                        >
                          <Star size={10} fill="currentColor" /> Mặc định
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm font-bold text-[#1E3932]">
                      <User size={14} className="shrink-0 text-gray-400" />
                      {addr.recipientName}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-sm text-gray-500">
                      <Phone size={14} className="shrink-0 text-gray-400" />
                      {addr.phone}
                    </div>
                    <div className="mt-1 flex items-start gap-2 text-sm text-gray-600">
                      <Home size={14} className="mt-0.5 shrink-0 text-gray-400" />
                      <span>{formatAddress(addr)}</span>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-2">
                    {!addr.isDefault && (
                      <button
                        onClick={() => void handleSetDefault(addr.id)}
                        disabled={settingDefaultId === addr.id}
                        className="text-xs font-semibold text-[#006241] hover:underline disabled:opacity-50"
                      >
                        {settingDefaultId === addr.id ? (
                          <LoaderCircle size={12} className="animate-spin" />
                        ) : (
                          'Đặt mặc định'
                        )}
                      </button>
                    )}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(addr)}
                        className="flex h-8 w-8 items-center justify-center rounded-xl text-gray-400 transition hover:bg-gray-100 hover:text-[#1E3932]"
                      >
                        <Edit2 size={14} />
                      </button>
                      {!addr.isDefault && (
                        <button
                          onClick={() => setDeleteTarget(addr)}
                          className="flex h-8 w-8 items-center justify-center rounded-xl text-gray-400 transition hover:bg-red-50 hover:text-red-500"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="client-card w-full max-w-lg">
            <div className="border-b border-black/5 px-6 pt-6 pb-4">
              <h2 className="text-lg font-black text-[#1E3932]">
                {editTarget ? 'Chỉnh sửa địa chỉ' : 'Thêm địa chỉ mới'}
              </h2>
            </div>

            <div className="space-y-4 px-6 py-5 max-h-[60vh] overflow-y-auto">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-500">
                    Họ và tên người nhận *
                  </label>
                  <input
                    value={form.recipientName}
                    onChange={(e) => setForm((f) => ({ ...f, recipientName: e.target.value }))}
                    placeholder="Nguyễn Văn A"
                    className={`w-full rounded-xl border px-4 py-2.5 text-sm outline-none focus:border-[#006241] ${
                      formErrors.recipientName ? 'border-red-400 bg-red-50' : 'border-black/10 bg-[#f2f0eb]'
                    }`}
                  />
                  {formErrors.recipientName && (
                    <p className="mt-1 text-xs text-red-500">{formErrors.recipientName}</p>
                  )}
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-500">
                    Số điện thoại *
                  </label>
                  <input
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="0901234567"
                    className={`w-full rounded-xl border px-4 py-2.5 text-sm outline-none focus:border-[#006241] ${
                      formErrors.phone ? 'border-red-400 bg-red-50' : 'border-black/10 bg-[#f2f0eb]'
                    }`}
                  />
                  {formErrors.phone && (
                    <p className="mt-1 text-xs text-red-500">{formErrors.phone}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-gray-500">
                  Địa chỉ cụ thể *
                </label>
                <input
                  value={form.addressLine}
                  onChange={(e) => setForm((f) => ({ ...f, addressLine: e.target.value }))}
                  placeholder="Số nhà, tên đường, khu phố..."
                  className={`w-full rounded-xl border px-4 py-2.5 text-sm outline-none focus:border-[#006241] ${
                    formErrors.addressLine ? 'border-red-400 bg-red-50' : 'border-black/10 bg-[#f2f0eb]'
                  }`}
                />
                {formErrors.addressLine && (
                  <p className="mt-1 text-xs text-red-500">{formErrors.addressLine}</p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {/* Province */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-500">
                    Tỉnh / Thành phố
                  </label>
                  <select
                    value={form.province}
                    disabled={loadingProvinces}
                    onChange={(e) => {
                      const selectedName = e.target.value;
                      setForm((f) => ({ ...f, province: selectedName, district: '', ward: '' }));
                      const found = provinces.find((p) => p.name === selectedName);
                      if (found) void fetchDistricts(found.code);
                      else { setDistricts([]); setWards([]); }
                    }}
                    className="client-input w-full px-4 py-2.5 text-sm disabled:opacity-60"
                  >
                    <option value="">
                      {loadingProvinces ? 'Đang tải...' : '-- Chọn tỉnh/thành phố --'}
                    </option>
                    {provinces.map((p) => (
                      <option key={p.code} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>

                {/* District */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-500">
                    Quận / Huyện
                  </label>
                  <select
                    value={form.district}
                    disabled={!form.province || loadingDistricts}
                    onChange={(e) => {
                      const selectedName = e.target.value;
                      setForm((f) => ({ ...f, district: selectedName, ward: '' }));
                      const found = districts.find((d) => d.name === selectedName);
                      if (found) void fetchWards(found.code);
                      else setWards([]);
                    }}
                    className="client-input w-full px-4 py-2.5 text-sm disabled:opacity-60"
                  >
                    <option value="">
                      {loadingDistricts ? 'Đang tải...' : !form.province ? '-- Chọn tỉnh trước --' : '-- Chọn quận/huyện --'}
                    </option>
                    {districts.map((d) => (
                      <option key={d.code} value={d.name}>{d.name}</option>
                    ))}
                  </select>
                </div>

                {/* Ward */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-500">
                    Phường / Xã
                  </label>
                  <select
                    value={form.ward}
                    disabled={!form.district || loadingWards}
                    onChange={(e) => setForm((f) => ({ ...f, ward: e.target.value }))}
                    className="client-input w-full px-4 py-2.5 text-sm disabled:opacity-60"
                  >
                    <option value="">
                      {loadingWards ? 'Đang tải...' : !form.district ? '-- Chọn quận trước --' : '-- Chọn phường/xã --'}
                    </option>
                    {wards.map((w) => (
                      <option key={w.code} value={w.name}>{w.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <label className="flex cursor-pointer items-center gap-3">
                <div
                  onClick={() => setForm((f) => ({ ...f, isDefault: !f.isDefault }))}
                  className={`flex h-5 w-5 items-center justify-center rounded border-2 transition ${
                    form.isDefault ? 'border-[#006241] bg-[#006241]' : 'border-black/20 bg-white'
                  }`}
                >
                  {form.isDefault && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <span className="text-sm font-medium text-[#1E3932]">Đặt làm địa chỉ mặc định</span>
              </label>
            </div>

            <div className="flex justify-end gap-3 border-t border-black/5 px-6 py-4">
              <button
                onClick={() => setFormOpen(false)}
                className="client-pill-dark-outline px-5 py-2.5 text-sm font-semibold"
              >
                Hủy
              </button>
              <button
                onClick={() => void handleSave()}
                disabled={saving}
                className="client-pill-primary flex items-center gap-2 px-6 py-2.5 text-sm font-bold disabled:opacity-60"
              >
                {saving ? <LoaderCircle size={14} className="animate-spin" /> : null}
                {saving ? 'Đang lưu...' : editTarget ? 'Lưu thay đổi' : 'Thêm địa chỉ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="client-card w-full max-w-sm">
            <div className="p-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
                <Trash2 size={20} className="text-red-500" />
              </div>
              <h3 className="font-black text-[#1E3932]">Xóa địa chỉ?</h3>
              <p className="mt-2 text-sm text-gray-500">
                Địa chỉ <span className="font-semibold">{deleteTarget.addressLine}</span> sẽ bị xóa vĩnh viễn.
              </p>
            </div>
            <div className="flex justify-end gap-3 border-t border-black/5 px-6 py-4">
              <button
                onClick={() => setDeleteTarget(null)}
                className="client-pill-dark-outline px-5 py-2.5 text-sm font-semibold"
              >
                Hủy
              </button>
              <button
                onClick={() => void handleDelete()}
                disabled={deleting}
                className="flex items-center gap-2 rounded-full bg-red-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deleting ? <LoaderCircle size={14} className="animate-spin" /> : null}
                {deleting ? 'Đang xóa...' : 'Xóa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
