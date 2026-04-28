import { useEffect, useMemo, useRef, useState } from 'react';
import { ShoppingCart, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../lib/api';
import { useAdminSession } from '../hooks/useAdminSession';
import {
  createOrdersAdminSocket,
  type AdminNewOrderEvent,
} from '../lib/orders-admin-realtime';

type AdminNewOrderToastProps = {
  collapsed: boolean;
};

type NotifItem = {
  id: string | null;
  title: string;
  message: string;
  metadata: Record<string, unknown> | null;
  createdAt: string | null;
  channel: string;
};

const AUTO_HIDE_MS = 6000;

function toOrderEvent(notification: NotifItem): AdminNewOrderEvent | null {
  const metadata = notification.metadata ?? {};
  if (metadata.type !== 'admin_order_created' || typeof metadata.orderId !== 'string') {
    return null;
  }

  return {
    orderId: metadata.orderId,
    fullName: typeof metadata.fullName === 'string' ? metadata.fullName : '',
    phone: typeof metadata.phone === 'string' ? metadata.phone : '',
    totalPayment:
      typeof metadata.totalPayment === 'string' ? metadata.totalPayment : '0',
    status: 'pending',
    paymentStatus: 'unpaid',
    createdAt: notification.createdAt ?? new Date().toISOString(),
  };
}

export default function AdminNewOrderToast({ collapsed }: AdminNewOrderToastProps) {
  const navigate = useNavigate();
  const { session } = useAdminSession();
  const [order, setOrder] = useState<AdminNewOrderEvent | null>(null);
  const lastSeenOrderIdRef = useRef<string | null>(null);
  const pollingSeededRef = useRef(false);
  const hideTimerRef = useRef<number | null>(null);

  const canManageOrders = useMemo(
    () =>
      session?.user.permissions?.some(
        (permission) => permission.key === 'manage_orders',
      ) ?? false,
    [session?.user.permissions],
  );

  const currency = useMemo(
    () =>
      new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
        maximumFractionDigits: 0,
      }),
    [],
  );

  function showNewOrder(nextOrder: AdminNewOrderEvent) {
    if (!nextOrder.orderId || lastSeenOrderIdRef.current === nextOrder.orderId) {
      return;
    }

    lastSeenOrderIdRef.current = nextOrder.orderId;
    setOrder(nextOrder);
  }

  useEffect(() => {
    if (!order) {
      return;
    }

    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
    }

    hideTimerRef.current = window.setTimeout(() => {
      setOrder(null);
      hideTimerRef.current = null;
    }, AUTO_HIDE_MS);

    return () => {
      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
  }, [order]);

  useEffect(() => {
    if (!session?.accessToken || !canManageOrders) {
      return;
    }

    const socket = createOrdersAdminSocket(session.accessToken);
    socket.on('orders:new', (payload: AdminNewOrderEvent) => {
      showNewOrder(payload);
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [canManageOrders, session?.accessToken]);

  useEffect(() => {
    if (!canManageOrders) {
      return;
    }

    let cancelled = false;

    async function pollLatestOrderNotification() {
      try {
        const items = await apiClient.get<NotifItem[]>('/notifications/admin/summary');
        if (cancelled) {
          return;
        }

        const latest = (items ?? [])
          .map(toOrderEvent)
          .find((item): item is AdminNewOrderEvent => Boolean(item));

        if (!latest) {
          pollingSeededRef.current = true;
          return;
        }

        if (!pollingSeededRef.current) {
          pollingSeededRef.current = true;
          lastSeenOrderIdRef.current = latest.orderId;
          return;
        }

        showNewOrder(latest);
      } catch {
        pollingSeededRef.current = true;
      }
    }

    void pollLatestOrderNotification();
    const intervalId = window.setInterval(() => {
      void pollLatestOrderNotification();
    }, 15_000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [canManageOrders]);

  if (!order) {
    return null;
  }

  const total = Number(order.totalPayment);
  const customer = order.fullName || order.phone || 'Khach hang moi';

  return (
    <div
      className={`fixed bottom-6 left-4 right-4 z-[90] max-w-[calc(100vw-2rem)] transition-all sm:right-auto sm:w-[380px] ${
        collapsed ? 'lg:left-[calc(4rem+1.5rem)]' : 'lg:left-[calc(16rem+1.5rem)]'
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="admin-card overflow-hidden border-[#00754A]/20 bg-white">
        <div className="flex items-start gap-3 border-l-4 border-[#00754A] px-4 py-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#1E3932] text-white">
            <ShoppingCart size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-[#1E3932]">Co don hang moi</p>
            <p className="mt-1 truncate text-sm font-semibold text-on-surface">
              {customer}
            </p>
            <p className="mt-0.5 text-xs text-on-surface-variant">
              {Number.isFinite(total) ? currency.format(total) : order.totalPayment}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setOrder(null);
                  navigate(`/admin/orders?openOrder=${encodeURIComponent(order.orderId)}`);
                }}
                className="admin-pill admin-pill-primary px-4 py-2 text-xs font-black"
              >
                Xem ngay
              </button>
              <span className="truncate text-[11px] text-on-surface-variant/70">
                {order.orderId}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOrder(null)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition hover:bg-on-surface/5 hover:text-[#006241]"
            aria-label="Dong thong bao don hang moi"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
