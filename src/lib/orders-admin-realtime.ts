import { io, type Socket } from 'socket.io-client';
import { getApiBaseUrl } from './api';

function getSocketBaseUrl() {
  const apiBaseUrl = getApiBaseUrl();

  try {
    return new URL(apiBaseUrl, window.location.origin).origin;
  } catch {
    return window.location.origin;
  }
}

export type AdminNewOrderEvent = {
  orderId: string;
  fullName: string;
  phone: string;
  totalPayment: string;
  status: string;
  paymentStatus: string;
  createdAt: string;
};

export function createOrdersAdminSocket(accessToken: string): Socket {
  return io(`${getSocketBaseUrl()}/orders-admin`, {
    auth: {
      token: accessToken,
    },
    withCredentials: true,
    transports: ['websocket', 'polling'],
  });
}
