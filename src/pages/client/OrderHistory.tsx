import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Package, ChevronRight, Leaf } from 'lucide-react';
import { clientApi } from '../../lib/client-api';
import { useClientSession } from '../../hooks/useClientSession';

type Order = {
  id: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  totalPayment: string;
  totalQuantity: number;
  fullName: string;
  phone: string;
  address: string;
  createdAt: string;
};

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Chờ xử lý', color: '#b45309', bg: '#fef3c7' },
  confirmed: { label: 'Đã xác nhận', color: '#1d4ed8', bg: '#dbeafe' },
  processing: { label: 'Đang xử lý', color: '#6d28d9', bg: '#ede9fe' },
  shipping: { label: 'Đang giao', color: '#0369a1', bg: '#e0f2fe' },
  delivered: { label: 'Đã giao', color: '#15803d', bg: '#dcfce7' },
  cancelled: { label: 'Đã hủy', color: '#dc2626', bg: '#fee2e2' },
  returned: { label: 'Đã trả hàng', color: '#9f1239', bg: '#ffe4e6' },
};

const PAYMENT_LABELS: Record<string, string> = {
  cod: 'COD',
  bank_transfer: 'Chuyển khoản',
  momo: 'MoMo',
  vnpay: 'VNPay',
};

function formatPrice(val: number | string) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(val));
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function OrderHistory() {
  const navigate = useNavigate();
  const { session } = useClientSession();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    if (!session) { void navigate('/client/login'); return; }
    void clientApi
      .get<Order[]>('/users/me/orders')
      .then((data) => setOrders(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session, navigate]);

  if (loading) {
    return (
      <div style={{ background: '#f2f0eb', minHeight: '60vh' }} className="flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#006241] border-t-transparent" />
      </div>
    );
  }

  const filteredOrders = filter === 'all' ? orders : orders.filter((o) => o.status === filter);

  return (
    <div style={{ background: '#f2f0eb', minHeight: '80vh' }}>
      <div className="mx-auto max-w-4xl px-4 py-10 lg:px-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em]" style={{ color: '#006241' }}>
              Cá nhân
            </p>
            <h1 className="mt-1 text-2xl font-black text-[#1E3932]">Đơn hàng của tôi</h1>
          </div>
          <Link to="/client/account" className="text-sm font-semibold text-[#006241] hover:underline">
            ← Tài khoản
          </Link>
        </div>

        {/* Filter tabs */}
        <div className="mb-5 flex gap-1.5 overflow-x-auto pb-1">
          {[
            { key: 'all', label: 'Tất cả' },
            { key: 'pending', label: 'Chờ xử lý' },
            { key: 'shipping', label: 'Đang giao' },
            { key: 'delivered', label: 'Đã giao' },
            { key: 'cancelled', label: 'Đã hủy' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition ${
                filter === tab.key
                  ? 'bg-[#006241] text-white'
                  : 'bg-white text-[#1E3932] hover:bg-[#006241]/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl bg-white py-20 text-center">
            <Package size={48} className="mb-4 text-[#006241]/20" />
            <h2 className="font-black text-[#1E3932]">
              {filter === 'all' ? 'Chưa có đơn hàng' : 'Không có đơn hàng'}
            </h2>
            <p className="mt-1 text-sm text-gray-500">Hãy khám phá và đặt hàng ngay!</p>
            <Link
              to="/client/products"
              className="mt-5 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-white"
              style={{ background: '#00754A' }}
            >
              <Leaf size={16} /> Khám phá sản phẩm
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => {
              const statusInfo = STATUS_LABELS[order.status] ?? { label: order.status, color: '#374151', bg: '#f3f4f6' };
              const shortId = order.id.slice(-8).toUpperCase();
              return (
                <Link
                  key={order.id}
                  to={`/client/orders/${order.id}`}
                  className="block overflow-hidden rounded-2xl bg-white shadow-sm transition-all hover:shadow-md"
                >
                  <div className="flex items-center justify-between border-b border-black/5 p-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-full"
                        style={{ background: statusInfo.bg }}
                      >
                        <Package size={18} style={{ color: statusInfo.color }} />
                      </div>
                      <div>
                        <p className="font-black text-[#1E3932]">Đơn #{shortId}</p>
                        <p className="text-xs text-gray-400">{formatDate(order.createdAt)}</p>
                      </div>
                    </div>
                    <span
                      className="rounded-full px-3 py-1 text-[11px] font-black"
                      style={{ background: statusInfo.bg, color: statusInfo.color }}
                    >
                      {statusInfo.label}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-4">
                    <div className="text-sm text-gray-500">
                      <p>
                        Thanh toán:{' '}
                        <span className="font-semibold text-[#1E3932]">
                          {PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod}
                        </span>
                      </p>
                      <p className="mt-0.5 line-clamp-1 max-w-xs text-xs">{order.address}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-black text-[#006241]">{formatPrice(order.totalPayment)}</p>
                        <p className="text-xs text-gray-400">{order.totalQuantity} sản phẩm</p>
                      </div>
                      <ChevronRight size={16} className="text-gray-300" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
