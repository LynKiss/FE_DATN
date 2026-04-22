import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { MapPin, Plus, Check, ChevronRight, ArrowLeft, Leaf, Truck } from 'lucide-react';

const VIETNAM_PROVINCES = [
  'An Giang','Bà Rịa - Vũng Tàu','Bắc Giang','Bắc Kạn','Bạc Liêu','Bắc Ninh','Bến Tre','Bình Định','Bình Dương','Bình Phước',
  'Bình Thuận','Cà Mau','Cần Thơ','Cao Bằng','Đà Nẵng','Đắk Lắk','Đắk Nông','Điện Biên','Đồng Nai','Đồng Tháp',
  'Gia Lai','Hà Giang','Hà Nam','Hà Nội','Hà Tĩnh','Hải Dương','Hải Phòng','Hậu Giang','Hòa Bình','Hưng Yên',
  'Khánh Hòa','Kiên Giang','Kon Tum','Lai Châu','Lâm Đồng','Lạng Sơn','Lào Cai','Long An','Nam Định','Nghệ An',
  'Ninh Bình','Ninh Thuận','Phú Thọ','Phú Yên','Quảng Bình','Quảng Nam','Quảng Ngãi','Quảng Ninh','Quảng Trị','Sóc Trăng',
  'Sơn La','Tây Ninh','Thái Bình','Thái Nguyên','Thanh Hóa','Thừa Thiên Huế','Tiền Giang','TP. Hồ Chí Minh','Trà Vinh',
  'Tuyên Quang','Vĩnh Long','Vĩnh Phúc','Yên Bái',
];
import { clientApi } from '../../lib/client-api';
import { useCart } from '../../hooks/useCart';
import { useClientSession } from '../../hooks/useClientSession';

type Address = {
  id: string;
  recipientName: string;
  phone: string;
  addressLine: string;
  ward?: string;
  district?: string;
  province: string;
  isDefault: boolean;
  label?: string;
};

type DeliveryMethod = {
  id: string;
  name: string;
  description: string | null;
  basePrice: string;
  minOrderAmount: string;
  isDefault: boolean;
};

function formatPrice(price: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
}

export default function Checkout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session } = useClientSession();
  const { cart } = useCart();

  const state = (location.state as { discountCode?: string; discountAmount?: number } | null) ?? {};
  const discountCode = state.discountCode;
  const discountAmount = state.discountAmount ?? 0;

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [deliveryMethods, setDeliveryMethods] = useState<DeliveryMethod[]>([]);
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string | null>(null);
  const [addingAddress, setAddingAddress] = useState(false);
  const [note, setNote] = useState('');
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [savingAddress, setSavingAddress] = useState(false);

  const [form, setForm] = useState({
    recipientName: session?.user.fullName ?? session?.user.username ?? '',
    phone: '',
    addressLine: '',
    ward: '',
    district: '',
    province: '',
    label: '',
  });

  useEffect(() => {
    if (!session) { void navigate('/client/login'); return; }

    void Promise.all([
      clientApi.get<Address[]>('/users/me/addresses'),
      clientApi.get<DeliveryMethod[]>('/delivery-methods'),
    ]).then(([addrs, deliveries]) => {
      const addrList = addrs ?? [];
      const deliveryList = deliveries ?? [];

      setAddresses(addrList);
      const def = addrList.find((a) => a.isDefault);
      if (def) setSelectedAddressId(def.id);
      else if (addrList[0]) setSelectedAddressId(addrList[0].id);

      setDeliveryMethods(deliveryList);
      const defDelivery = deliveryList.find((d) => d.isDefault);
      if (defDelivery) setSelectedDeliveryId(defDelivery.id);
      else if (deliveryList[0]) setSelectedDeliveryId(deliveryList[0].id);
    }).catch(() => {}).finally(() => setLoadingAddresses(false));
  }, [session, navigate]);

  if (!session || !cart) return null;

  const subtotal = Number(cart.totalAmount);
  const selectedDelivery = deliveryMethods.find((d) => d.id === selectedDeliveryId);
  const shipping = selectedDelivery ? Number(selectedDelivery.basePrice) : 0;
  const total = Math.max(0, subtotal - discountAmount) + shipping;

  const handleSaveAddress = async () => {
    if (!form.recipientName || !form.phone || !form.addressLine || !form.province) return;
    setSavingAddress(true);
    try {
      const newAddr = await clientApi.post<Address>('/users/me/addresses', {
        recipientName: form.recipientName,
        phone: form.phone,
        addressLine: form.addressLine,
        ward: form.ward || undefined,
        district: form.district || undefined,
        province: form.province,
        label: form.label || undefined,
      });
      setAddresses((prev) => [...prev, newAddr]);
      setSelectedAddressId(newAddr.id);
      setAddingAddress(false);
      setForm({ recipientName: '', phone: '', addressLine: '', ward: '', district: '', province: '', label: '' });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Không thể lưu địa chỉ');
    } finally {
      setSavingAddress(false);
    }
  };

  const handleContinue = () => {
    if (!selectedAddressId || !selectedDeliveryId) return;
    const addr = addresses.find((a) => a.id === selectedAddressId);
    const addrText = addr
      ? [addr.recipientName, addr.phone, addr.addressLine, addr.ward, addr.district, addr.province]
          .filter(Boolean)
          .join(', ')
      : '';
    void navigate('/client/payment', {
      state: {
        shippingAddressId: selectedAddressId,
        deliveryId: selectedDeliveryId,
        shippingAddress: addrText,
        deliveryName: selectedDelivery?.name ?? '',
        shippingCost: shipping,
        note,
        discountCode,
        discountAmount,
        subtotal,
        total,
      },
    });
  };

  return (
    <div style={{ background: '#f2f0eb', minHeight: '80vh' }}>
      <div className="mx-auto max-w-5xl px-4 py-10 lg:px-6">
        {/* Steps */}
        <div className="mb-8 flex items-center justify-center gap-3 text-sm">
          {[
            { label: 'Giỏ hàng', done: true },
            { label: 'Địa chỉ & Vận chuyển', active: true },
            { label: 'Thanh toán' },
            { label: 'Xác nhận' },
          ].map((step, i) => (
            <div key={step.label} className="flex items-center gap-2">
              {i > 0 && <ChevronRight size={14} className="text-gray-300" />}
              <span
                className={`text-sm font-semibold ${
                  step.done ? 'text-[#006241]' : step.active ? 'text-[#1E3932] font-black' : 'text-gray-400'
                }`}
              >
                {step.done ? '✓ ' : ''}{step.label}
              </span>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-6">
            {/* Addresses */}
            <div>
              <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-[#1E3932]">
                <MapPin size={20} className="text-[#006241]" /> Địa chỉ giao hàng
              </h2>

              {loadingAddresses ? (
                <div className="flex justify-center py-8">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#006241] border-t-transparent" />
                </div>
              ) : (
                <div className="space-y-3">
                  {addresses.map((addr) => (
                    <button
                      key={addr.id}
                      onClick={() => { setSelectedAddressId(addr.id); setAddingAddress(false); }}
                      className={`w-full rounded-2xl border-2 p-4 text-left transition ${
                        selectedAddressId === addr.id && !addingAddress
                          ? 'border-[#006241] bg-[#006241]/5'
                          : 'border-transparent bg-white hover:border-[#006241]/30'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-[#1E3932]">{addr.recipientName}</p>
                            {addr.isDefault && (
                              <span className="rounded-full bg-[#006241]/10 px-2 py-0.5 text-[10px] font-black text-[#006241]">
                                Mặc định
                              </span>
                            )}
                            {addr.label && (
                              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500">
                                {addr.label}
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-sm text-gray-500">{addr.phone}</p>
                          <p className="mt-1 text-sm text-gray-600">
                            {[addr.addressLine, addr.ward, addr.district, addr.province].filter(Boolean).join(', ')}
                          </p>
                        </div>
                        {selectedAddressId === addr.id && !addingAddress && (
                          <Check size={18} className="shrink-0 text-[#006241]" />
                        )}
                      </div>
                    </button>
                  ))}

                  {!addingAddress ? (
                    <button
                      onClick={() => { setAddingAddress(true); setSelectedAddressId(null); }}
                      className="flex w-full items-center gap-2 rounded-2xl border-2 border-dashed border-[#006241]/20 bg-white px-5 py-4 text-sm font-semibold text-[#006241] transition hover:border-[#006241]/40"
                    >
                      <Plus size={16} /> Thêm địa chỉ mới
                    </button>
                  ) : (
                    <div className="rounded-2xl border-2 border-[#006241] bg-white p-5">
                      <h3 className="mb-4 font-bold text-[#1E3932]">Địa chỉ mới</h3>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {[
                          { key: 'recipientName', label: 'Họ và tên *', placeholder: 'Nguyễn Văn A' },
                          { key: 'phone', label: 'Số điện thoại *', placeholder: '0901234567' },
                          { key: 'addressLine', label: 'Địa chỉ cụ thể *', placeholder: '123 Đường ABC', span: true },
                          { key: 'ward', label: 'Phường/Xã', placeholder: 'Phường 5' },
                          { key: 'district', label: 'Quận/Huyện', placeholder: 'Quận 12' },
                          { key: 'label', label: 'Nhãn (tùy chọn)', placeholder: 'Nhà, Công ty...' },
                        ].map((field) => (
                          <div key={field.key} className={(field as { span?: boolean }).span ? 'sm:col-span-2' : ''}>
                            <label className="mb-1 block text-xs font-semibold text-gray-500">{field.label}</label>
                            <input
                              value={form[field.key as keyof typeof form]}
                              onChange={(e) => setForm((f) => ({ ...f, [field.key]: e.target.value }))}
                              placeholder={field.placeholder}
                              className="w-full rounded-xl border border-black/10 bg-[#f2f0eb] px-4 py-2.5 text-sm outline-none focus:border-[#006241]"
                            />
                          </div>
                        ))}
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-gray-500">Tỉnh/Thành phố *</label>
                          <select
                            value={form.province}
                            onChange={(e) => setForm((f) => ({ ...f, province: e.target.value }))}
                            className="w-full rounded-xl border border-black/10 bg-[#f2f0eb] px-4 py-2.5 text-sm outline-none focus:border-[#006241]"
                          >
                            <option value="">-- Chọn tỉnh/thành phố --</option>
                            {VIETNAM_PROVINCES.map((p) => (
                              <option key={p} value={p}>{p}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="mt-4 flex gap-2">
                        <button
                          onClick={() => void handleSaveAddress()}
                          disabled={savingAddress}
                          className="flex-1 rounded-full py-2.5 text-sm font-bold text-white disabled:opacity-60"
                          style={{ background: '#006241' }}
                        >
                          {savingAddress ? 'Đang lưu...' : 'Lưu địa chỉ'}
                        </button>
                        <button
                          onClick={() => setAddingAddress(false)}
                          className="rounded-full border border-black/10 px-4 py-2.5 text-sm font-semibold text-gray-500"
                        >
                          Hủy
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Delivery methods */}
            {deliveryMethods.length > 0 && (
              <div>
                <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-[#1E3932]">
                  <Truck size={20} className="text-[#006241]" /> Phương thức vận chuyển
                </h2>
                <div className="space-y-3">
                  {deliveryMethods.map((dm) => (
                    <button
                      key={dm.id}
                      onClick={() => setSelectedDeliveryId(dm.id)}
                      className={`w-full rounded-2xl border-2 p-4 text-left transition ${
                        selectedDeliveryId === dm.id
                          ? 'border-[#006241] bg-[#006241]/5'
                          : 'border-transparent bg-white hover:border-[#006241]/30'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold text-[#1E3932]">{dm.name}</p>
                          {dm.description && (
                            <p className="mt-0.5 text-xs text-gray-500">{dm.description}</p>
                          )}
                          {Number(dm.minOrderAmount) > 0 && (
                            <p className="mt-0.5 text-[10px] text-orange-500">
                              Đơn tối thiểu {formatPrice(Number(dm.minOrderAmount))}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`font-black text-sm ${Number(dm.basePrice) === 0 ? 'text-[#006241]' : 'text-[#1E3932]'}`}>
                            {Number(dm.basePrice) === 0 ? 'Miễn phí' : formatPrice(Number(dm.basePrice))}
                          </span>
                          <div
                            className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition ${
                              selectedDeliveryId === dm.id ? 'border-[#006241] bg-[#006241]' : 'border-gray-300'
                            }`}
                          >
                            {selectedDeliveryId === dm.id && <div className="h-2 w-2 rounded-full bg-white" />}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Note */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-[#1E3932]">
                Ghi chú đơn hàng (tùy chọn)
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="Hướng dẫn giao hàng, yêu cầu đặc biệt..."
                className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-[#006241]"
              />
            </div>

            <div className="flex gap-3">
              <Link
                to="/client/cart"
                className="flex items-center gap-2 rounded-full border border-black/10 px-5 py-3 text-sm font-semibold text-gray-500 transition hover:border-[#006241] hover:text-[#006241]"
              >
                <ArrowLeft size={15} /> Quay lại giỏ hàng
              </Link>
              <button
                onClick={handleContinue}
                disabled={!selectedAddressId || !selectedDeliveryId || addingAddress}
                className="flex flex-1 items-center justify-center gap-2 rounded-full py-3 text-sm font-bold text-white disabled:opacity-50 active:scale-95"
                style={{ background: '#00754A' }}
              >
                Tiếp tục thanh toán <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Order summary */}
          <div>
            <div className="rounded-2xl bg-white p-5">
              <p className="mb-4 text-sm font-black uppercase tracking-wider text-gray-400">
                Đơn hàng ({cart.totalItems} sản phẩm)
              </p>
              <div className="max-h-64 space-y-3 overflow-y-auto">
                {cart.items.map((item) => (
                  <div key={item.id} className="flex items-start gap-3">
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-[#f2f0eb]">
                      {item.primaryImageUrl ? (
                        <img
                          src={item.primaryImageUrl}
                          alt={item.productName ?? ''}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <Leaf size={18} className="text-[#006241]/30" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="line-clamp-2 text-xs font-semibold text-[#1E3932]">
                        {item.productName}
                      </p>
                      <p className="text-xs text-gray-400">x{item.quantity}</p>
                    </div>
                    <p className="shrink-0 text-xs font-bold text-[#006241]">
                      {formatPrice(Number(item.lineTotal))}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-4 space-y-2 border-t border-black/5 pt-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Tạm tính</span>
                  <span className="font-semibold">{formatPrice(subtotal)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Giảm giá</span>
                    <span className="font-semibold text-red-500">-{formatPrice(discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Vận chuyển</span>
                  <span className={`font-semibold ${shipping === 0 ? 'text-[#006241]' : ''}`}>
                    {selectedDelivery
                      ? shipping === 0 ? 'Miễn phí' : formatPrice(shipping)
                      : '—'}
                  </span>
                </div>
                <div className="flex justify-between border-t border-black/5 pt-2 text-base">
                  <span className="font-black text-[#1E3932]">Tổng cộng</span>
                  <span className="font-black text-[#006241]">{formatPrice(total)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
