import { io, type Socket } from 'socket.io-client';

export type SupportConversationStatus =
  | 'waiting_staff'
  | 'waiting_customer'
  | 'resolved';

export type SupportChatActorRole = 'customer' | 'staff';

export type SupportParticipant = {
  _id: string;
  username: string;
  email: string | null;
  avatarUrl: string | null;
  role: string;
};

export type SupportConversation = {
  conversationId: string;
  status: SupportConversationStatus;
  customerUnreadCount: number;
  staffUnreadCount: number;
  lastMessagePreview: string | null;
  lastMessageSenderRole: SupportChatActorRole | null;
  lastMessageAt: string | null;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  customer: SupportParticipant;
  assignedStaff: SupportParticipant | null;
};

export type SupportMessage = {
  messageId: string;
  conversationId: string;
  content: string;
  senderRole: SupportChatActorRole;
  readAt: string | null;
  createdAt: string;
  sender: SupportParticipant;
};

export const SUPPORT_STATUS_LABELS: Record<SupportConversationStatus, string> = {
  waiting_staff: 'Đang chờ nhân viên',
  waiting_customer: 'Đang chờ khách',
  resolved: 'Đã xử lý',
};

export const SUPPORT_STATUS_STYLES: Record<SupportConversationStatus, string> = {
  waiting_staff: 'bg-amber-100 text-amber-700',
  waiting_customer: 'bg-sky-100 text-sky-700',
  resolved: 'bg-emerald-100 text-emerald-700',
};

function getSocketBaseUrl() {
  const apiBaseUrl =
    import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, '') ??
    `${window.location.origin}/api/v1`;

  try {
    return new URL(apiBaseUrl, window.location.origin).origin;
  } catch {
    return window.location.origin;
  }
}

export function createSupportChatSocket(accessToken: string): Socket {
  return io(`${getSocketBaseUrl()}/support-chat`, {
    auth: {
      token: accessToken,
    },
    withCredentials: true,
    transports: ['websocket', 'polling'],
  });
}

export function sortSupportConversations(
  conversations: SupportConversation[],
) {
  return [...conversations].sort((left, right) => {
    const leftTime =
      Date.parse(left.lastMessageAt ?? left.updatedAt ?? left.createdAt) || 0;
    const rightTime =
      Date.parse(right.lastMessageAt ?? right.updatedAt ?? right.createdAt) || 0;

    return rightTime - leftTime;
  });
}
