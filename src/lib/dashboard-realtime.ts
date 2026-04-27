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

export function createDashboardSocket(accessToken: string): Socket {
  return io(`${getSocketBaseUrl()}/dashboard`, {
    auth: {
      token: accessToken,
    },
    withCredentials: true,
    transports: ['websocket', 'polling'],
  });
}
