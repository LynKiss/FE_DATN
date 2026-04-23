import {
  LoaderCircle,
  MessageCircleMore,
  RefreshCw,
  Search,
  Send,
  UserRound,
} from 'lucide-react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import Pagination from '../components/shared/Pagination';
import { useAdminSession } from '../hooks/useAdminSession';
import { useToast } from '../hooks/useToast';
import { useLanguage } from '../i18n/language-context';
import { apiClient } from '../lib/api';
import {
  SUPPORT_STATUS_LABELS,
  SUPPORT_STATUS_STYLES,
  type SupportConversation,
  type SupportConversationStatus,
  type SupportMessage,
  createSupportChatSocket,
  sortSupportConversations,
} from '../lib/support-chat';

type SupportConversationsResponse = {
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  items: SupportConversation[];
};

const LIMIT_OPTIONS = [10, 20, 30, 50];

function upsertConversation(
  current: SupportConversation[],
  incoming: SupportConversation,
) {
  const next = current.some(
    (conversation) => conversation.conversationId === incoming.conversationId,
  )
    ? current.map((conversation) =>
        conversation.conversationId === incoming.conversationId
          ? incoming
          : conversation,
      )
    : [incoming, ...current];

  return sortSupportConversations(next);
}

function appendMessage(current: SupportMessage[], incoming: SupportMessage) {
  if (current.some((message) => message.messageId === incoming.messageId)) {
    return current;
  }

  return [...current].concat(incoming).sort((left, right) => {
    return Date.parse(left.createdAt) - Date.parse(right.createdAt);
  });
}

function formatConversationTime(value: string | null) {
  if (!value) {
    return 'Vua tao';
  }

  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(value));
}

function unwrapSocketPayload<T>(payload: T | { data: T }) {
  if (
    payload &&
    typeof payload === 'object' &&
    'data' in payload &&
    payload.data
  ) {
    return payload.data;
  }

  return payload as T;
}

export default function SupportChats() {
  const { session } = useAdminSession();
  const { language } = useLanguage();
  const { showToast } = useToast();
  const isVietnamese = language === 'vi';

  const [conversations, setConversations] = useState<SupportConversation[]>([]);
  const [meta, setMeta] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null);
  const [selectedConversation, setSelectedConversation] =
    useState<SupportConversation | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [startingConversation, setStartingConversation] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [draft, setDraft] = useState('');
  const [customerLookup, setCustomerLookup] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'all' | SupportConversationStatus
  >('all');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const socketRef = useRef<ReturnType<typeof createSupportChatSocket> | null>(
    null,
  );
  const selectedConversationIdRef = useRef<string | null>(null);
  const joinedConversationIdRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    selectedConversationIdRef.current = selectedConversationId;
  }, [selectedConversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedConversationId]);

  async function loadConversations(options?: { silent?: boolean }) {
    if (!options?.silent) {
      setLoading(true);
    }

    const query = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });

    if (search.trim()) {
      query.set('search', search.trim());
    }

    if (statusFilter !== 'all') {
      query.set('status', statusFilter);
    }

    try {
      const response = await apiClient.get<SupportConversationsResponse>(
        `/support-chat/admin/conversations?${query.toString()}`,
      );

      setConversations(response.items);
      setMeta(response.meta);

      if (
        !selectedConversationIdRef.current ||
        !response.items.some(
          (conversation) =>
            conversation.conversationId === selectedConversationIdRef.current,
        )
      ) {
        setSelectedConversationId(response.items[0]?.conversationId ?? null);
      }
    } catch (error) {
      if (!options?.silent) {
        showToast({
          tone: 'error',
          title: 'Khong tai duoc danh sach chat',
          description: error instanceof Error ? error.message : '',
        });
      }
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  }

  async function loadConversationDetail(
    conversationId: string,
    options?: { silent?: boolean },
  ) {
    if (!options?.silent) {
      setMessagesLoading(true);
    }

    try {
      const [conversation, history] = await Promise.all([
        apiClient.patch<SupportConversation>(
          `/support-chat/conversations/${conversationId}/read`,
        ),
        apiClient.get<SupportMessage[]>(
          `/support-chat/conversations/${conversationId}/messages?limit=100`,
        ),
      ]);

      setSelectedConversation(conversation);
      setMessages(history);
      setConversations((current) => upsertConversation(current, conversation));
    } catch (error) {
      if (!options?.silent) {
        showToast({
          tone: 'error',
          title: 'Khong tai duoc hoi thoai',
          description: error instanceof Error ? error.message : '',
        });
      }
    } finally {
      if (!options?.silent) {
        setMessagesLoading(false);
      }
    }
  }

  useEffect(() => {
    if (!session?.accessToken) {
      return;
    }

    void loadConversations();
  }, [limit, page, search, session?.accessToken, statusFilter]);

  useEffect(() => {
    if (!selectedConversationId) {
      setSelectedConversation(null);
      setMessages([]);
      return;
    }

    if (
      socketRef.current &&
      joinedConversationIdRef.current &&
      joinedConversationIdRef.current !== selectedConversationId
    ) {
      socketRef.current.emit('conversation:leave', {
        conversationId: joinedConversationIdRef.current,
      });
    }

    if (socketRef.current?.connected) {
      socketRef.current.emit('conversation:join', {
        conversationId: selectedConversationId,
      });
      joinedConversationIdRef.current = selectedConversationId;
    }

    void loadConversationDetail(selectedConversationId);
  }, [selectedConversationId]);

  useEffect(() => {
    if (!session?.accessToken) {
      return;
    }

    const socket = createSupportChatSocket(session.accessToken);
    socketRef.current = socket;

    socket.on('connect', () => {
      setSocketConnected(true);

      if (selectedConversationIdRef.current) {
        socket.emit('conversation:join', {
          conversationId: selectedConversationIdRef.current,
        });
        joinedConversationIdRef.current = selectedConversationIdRef.current;
      }
    });

    socket.on('disconnect', () => {
      setSocketConnected(false);
    });

    socket.on('support:error', (payload: { message?: string }) => {
      if (!payload?.message) {
        return;
      }

      showToast({
        tone: 'error',
        title: 'Socket chat loi',
        description: payload.message,
      });
    });

    socket.on('support:conversation', (incoming: SupportConversation) => {
      setConversations((current) => upsertConversation(current, incoming));
      setSelectedConversation((current) =>
        current?.conversationId === incoming.conversationId ? incoming : current,
      );
    });

    socket.on(
      'support:message',
      (payload: { conversationId: string; message: SupportMessage }) => {
        if (payload.conversationId !== selectedConversationIdRef.current) {
          return;
        }

        setMessages((current) => appendMessage(current, payload.message));

        if (payload.message.senderRole === 'customer') {
          socket.emit('conversation:read', {
            conversationId: payload.conversationId,
          });
        }
      },
    );

    socket.on(
      'conversation:joined',
      (
        payload:
          | {
              conversation: SupportConversation;
              messages: SupportMessage[];
            }
          | {
              data: {
                conversation: SupportConversation;
                messages: SupportMessage[];
              };
            },
      ) => {
        const resolved = unwrapSocketPayload(payload);
        if (
          resolved.conversation.conversationId !== selectedConversationIdRef.current
        ) {
          return;
        }

        setSelectedConversation(resolved.conversation);
        setConversations((current) =>
          upsertConversation(current, resolved.conversation),
        );
        setMessages(resolved.messages);
        setMessagesLoading(false);
      },
    );

    socket.on(
      'conversation:read',
      (
        payload:
          | SupportConversation
          | {
              data: SupportConversation;
            },
      ) => {
        const resolved = unwrapSocketPayload(payload);
        setSelectedConversation((current) =>
          current?.conversationId === resolved.conversationId
            ? resolved
            : current,
        );
        setConversations((current) => upsertConversation(current, resolved));
      },
    );

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setSocketConnected(false);
    };
  }, [session?.accessToken, showToast]);

  useEffect(() => {
    if (socketConnected) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void loadConversations({ silent: true });

      if (selectedConversationIdRef.current) {
        void loadConversationDetail(selectedConversationIdRef.current, {
          silent: true,
        });
      }
    }, 4000);

    return () => window.clearInterval(intervalId);
  }, [socketConnected, limit, page, search, statusFilter]);

  const waitingStaffCount = useMemo(() => {
    return conversations.filter(
      (conversation) => conversation.status === 'waiting_staff',
    ).length;
  }, [conversations]);

  const unresolvedCount = useMemo(() => {
    return conversations.filter(
      (conversation) => conversation.status !== 'resolved',
    ).length;
  }, [conversations]);

  async function handleStartConversation(event: FormEvent) {
    event.preventDefault();

    if (!customerLookup.trim()) {
      return;
    }

    setStartingConversation(true);

    try {
      const conversation = await apiClient.post<SupportConversation>(
        '/support-chat/admin/conversations/start',
        {
          customerLookup: customerLookup.trim(),
        },
      );

      setConversations((current) => upsertConversation(current, conversation));
      setSelectedConversationId(conversation.conversationId);
      setCustomerLookup('');
      showToast({
        tone: 'success',
        title: 'Da mo cuoc tro chuyen',
      });
    } catch (error) {
      showToast({
        tone: 'error',
        title: 'Khong the mo cuoc tro chuyen',
        description: error instanceof Error ? error.message : '',
      });
    } finally {
      setStartingConversation(false);
    }
  }

  async function handleAssignConversation() {
    if (!selectedConversation) {
      return;
    }

    try {
      const conversation = await apiClient.patch<SupportConversation>(
        `/support-chat/admin/conversations/${selectedConversation.conversationId}/assign`,
      );

      setSelectedConversation(conversation);
      setConversations((current) => upsertConversation(current, conversation));
      showToast({
        tone: 'success',
        title: 'Da nhan cuoc tro chuyen',
      });
    } catch (error) {
      showToast({
        tone: 'error',
        title: 'Nhan cuoc tro chuyen that bai',
        description: error instanceof Error ? error.message : '',
      });
    }
  }

  async function handleUpdateStatus(status: SupportConversationStatus) {
    if (!selectedConversation) {
      return;
    }

    try {
      const conversation = await apiClient.patch<SupportConversation>(
        `/support-chat/admin/conversations/${selectedConversation.conversationId}/status`,
        { status },
      );

      setSelectedConversation(conversation);
      setConversations((current) => upsertConversation(current, conversation));
      showToast({
        tone: 'success',
        title:
          status === 'resolved'
            ? 'Da dong cuoc tro chuyen'
            : 'Da mo lai cuoc tro chuyen',
      });
    } catch (error) {
      showToast({
        tone: 'error',
        title: 'Cap nhat trang thai that bai',
        description: error instanceof Error ? error.message : '',
      });
    }
  }

  async function handleSendMessage(event: FormEvent) {
    event.preventDefault();

    if (!selectedConversationId || !draft.trim()) {
      return;
    }

    const content = draft.trim();
    setSending(true);
    setDraft('');

    try {
      if (socketRef.current?.connected) {
        socketRef.current.emit('message:send', {
          conversationId: selectedConversationId,
          content,
        });
      } else {
        const result = await apiClient.post<{
          conversation: SupportConversation;
          message: SupportMessage;
        }>(`/support-chat/conversations/${selectedConversationId}/messages`, {
          content,
        });

        setSelectedConversation(result.conversation);
        setConversations((current) =>
          upsertConversation(current, result.conversation),
        );
        setMessages((current) => appendMessage(current, result.message));
      }
    } catch (error) {
      setDraft(content);
      showToast({
        tone: 'error',
        title: 'Gui tin nhan that bai',
        description: error instanceof Error ? error.message : '',
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-primary">
            Chat ho tro khach hang
          </h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Dashboard theo doi hoi thoai voi khach hang theo thoi gian thuc.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <StatusPill label="Dang cho NV" value={waitingStaffCount} tone="amber" />
          <StatusPill label="Chua xu ly" value={unresolvedCount} tone="sky" />
          <StatusPill
            label={socketConnected ? 'Socket online' : 'Polling fallback'}
            value={socketConnected ? 'Live' : '4s'}
            tone={socketConnected ? 'emerald' : 'amber'}
          />
        </div>
      </div>

      <section className="rounded-[2rem] border border-on-surface/8 bg-white p-5 shadow-sm">
        <form
          onSubmit={handleStartConversation}
          className="grid gap-3 lg:grid-cols-[1fr_auto]"
        >
          <label className="relative">
            <Search
              size={16}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50"
            />
            <input
              value={customerLookup}
              onChange={(event) => setCustomerLookup(event.target.value)}
              placeholder="Nhap userId / username / email khach hang..."
              className="w-full rounded-2xl border border-on-surface/10 bg-surface px-11 py-3 text-sm text-on-surface outline-none transition focus:border-primary/30"
            />
          </label>
          <button
            type="submit"
            disabled={startingConversation || !customerLookup.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {startingConversation ? (
              <LoaderCircle size={16} className="animate-spin" />
            ) : (
              <MessageCircleMore size={16} />
            )}
            Mo tro chuyen
          </button>
        </form>

        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_200px_auto]">
          <label className="relative">
            <Search
              size={16}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50"
            />
            <input
              value={search}
              onChange={(event) => {
                setPage(1);
                setSearch(event.target.value);
              }}
              placeholder="Tim theo ma chat, userId, username, email..."
              className="w-full rounded-2xl border border-on-surface/10 bg-surface px-11 py-3 text-sm text-on-surface outline-none transition focus:border-primary/30"
            />
          </label>

          <select
            value={statusFilter}
            onChange={(event) => {
              setPage(1);
              setStatusFilter(
                event.target.value as 'all' | SupportConversationStatus,
              );
            }}
            className="rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary/30"
          >
            <option value="all">Tat ca trang thai</option>
            <option value="waiting_staff">Dang cho nhan vien</option>
            <option value="waiting_customer">Dang cho khach</option>
            <option value="resolved">Da xu ly</option>
          </select>

          <button
            type="button"
            onClick={() => {
              setPage(1);
              setSearch('');
              setStatusFilter('all');
            }}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-on-surface/10 bg-white px-4 py-3 text-sm font-semibold text-on-surface transition hover:border-primary/20 hover:text-primary"
          >
            <RefreshCw size={16} />
            Reset bo loc
          </button>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <section className="rounded-[2rem] border border-on-surface/8 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-on-surface/8 px-5 py-4">
            <div>
              <p className="text-sm font-black text-on-surface">
                Danh sach hoi thoai
              </p>
              <p className="text-xs text-on-surface-variant">
                {loading ? 'Dang tai...' : `${meta.total} cuoc tro chuyen`}
              </p>
            </div>
          </div>

          <div className="max-h-[68vh] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <LoaderCircle size={20} className="animate-spin text-primary" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="px-6 py-16 text-center text-sm text-on-surface-variant">
                Khong co cuoc tro chuyen nao khop bo loc hien tai.
              </div>
            ) : (
              conversations.map((conversation) => {
                const isActive =
                  conversation.conversationId === selectedConversationId;

                return (
                  <button
                    key={conversation.conversationId}
                    type="button"
                    onClick={() =>
                      setSelectedConversationId(conversation.conversationId)
                    }
                    className={`flex w-full items-start gap-3 border-b border-on-surface/6 px-5 py-4 text-left transition ${
                      isActive ? 'bg-primary/6' : 'hover:bg-surface'
                    }`}
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <UserRound size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-on-surface">
                            {conversation.customer.username}
                          </p>
                          <p className="truncate text-xs text-on-surface-variant">
                            {conversation.customer.email ??
                              conversation.customer._id}
                          </p>
                        </div>
                        <span className="shrink-0 text-[11px] font-medium text-on-surface-variant/70">
                          {formatConversationTime(
                            conversation.lastMessageAt ?? conversation.createdAt,
                          )}
                        </span>
                      </div>

                      <div className="mt-2 flex items-center gap-2">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                            SUPPORT_STATUS_STYLES[conversation.status]
                          }`}
                        >
                          {SUPPORT_STATUS_LABELS[conversation.status]}
                        </span>
                        {conversation.staffUnreadCount > 0 ? (
                          <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">
                            {conversation.staffUnreadCount} unread
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-2 line-clamp-2 text-sm text-on-surface-variant">
                        {conversation.lastMessagePreview ??
                          'Chua co tin nhan, cho nhan vien bat dau.'}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="px-5 pb-5">
            <Pagination
              page={meta.page}
              limit={limit}
              total={meta.total}
              totalPages={meta.totalPages}
              isVietnamese={isVietnamese}
              onPageChange={setPage}
              onLimitChange={(nextLimit) => {
                setPage(1);
                setLimit(nextLimit);
              }}
              pageSizeOptions={LIMIT_OPTIONS}
            />
          </div>
        </section>

        <section className="overflow-hidden rounded-[2rem] border border-on-surface/8 bg-white shadow-sm">
          {selectedConversation ? (
            <>
              <div className="border-b border-on-surface/8 px-6 py-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h2 className="text-xl font-black text-on-surface">
                      {selectedConversation.customer.username}
                    </h2>
                    <p className="mt-1 text-sm text-on-surface-variant">
                      {selectedConversation.customer.email ??
                        selectedConversation.customer._id}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                          SUPPORT_STATUS_STYLES[selectedConversation.status]
                        }`}
                      >
                        {SUPPORT_STATUS_LABELS[selectedConversation.status]}
                      </span>
                      <span className="inline-flex rounded-full bg-surface px-3 py-1 text-xs font-semibold text-on-surface-variant">
                        {selectedConversation.assignedStaff
                          ? `Nhan vien: ${selectedConversation.assignedStaff.username}`
                          : 'Chua co nhan vien phu trach'}
                      </span>
                      <span className="inline-flex rounded-full bg-surface px-3 py-1 text-xs font-semibold text-on-surface-variant">
                        Ma chat: {selectedConversation.conversationId.slice(0, 8)}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {!selectedConversation.assignedStaff ? (
                      <button
                        type="button"
                        onClick={() => void handleAssignConversation()}
                        className="rounded-2xl border border-primary/20 bg-primary/8 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary/12"
                      >
                        Nhan cuoc tro chuyen
                      </button>
                    ) : null}
                    {selectedConversation.status !== 'resolved' ? (
                      <button
                        type="button"
                        onClick={() => void handleUpdateStatus('resolved')}
                        className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
                      >
                        Danh dau da xu ly
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handleUpdateStatus('waiting_staff')}
                        className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 transition hover:bg-amber-100"
                      >
                        Mo lai hoi thoai
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex h-[62vh] flex-col bg-[#f7f5f1]">
                <div className="flex-1 overflow-y-auto px-6 py-5">
                  {messagesLoading ? (
                    <div className="flex h-full items-center justify-center">
                      <LoaderCircle
                        size={20}
                        className="animate-spin text-primary"
                      />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-sm text-on-surface-variant">
                      Chua co tin nhan nao. Hay bat dau phan hoi khach hang.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {messages.map((message) => {
                        const isStaff = message.senderRole === 'staff';

                        return (
                          <div
                            key={message.messageId}
                            className={`flex ${
                              isStaff ? 'justify-end' : 'justify-start'
                            }`}
                          >
                            <div
                              className={`max-w-[78%] rounded-[1.5rem] px-4 py-3 shadow-sm ${
                                isStaff
                                  ? 'rounded-br-md bg-primary text-white'
                                  : 'rounded-bl-md bg-white text-on-surface'
                              }`}
                            >
                              <p className="text-sm leading-relaxed">
                                {message.content}
                              </p>
                              <p
                                className={`mt-2 text-[11px] ${
                                  isStaff
                                    ? 'text-white/70'
                                    : 'text-on-surface-variant/70'
                                }`}
                              >
                                {message.sender.username} ·{' '}
                                {formatConversationTime(message.createdAt)}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </div>

                <form
                  onSubmit={(event) => void handleSendMessage(event)}
                  className="border-t border-on-surface/8 bg-white px-6 py-4"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-end">
                    <textarea
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      rows={3}
                      placeholder="Nhap phan hoi cho khach hang..."
                      disabled={selectedConversation.status === 'resolved'}
                      className="min-h-[92px] flex-1 rounded-[1.5rem] border border-on-surface/10 bg-surface px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary/30 disabled:cursor-not-allowed disabled:opacity-60"
                    />
                    <button
                      type="submit"
                      disabled={
                        sending ||
                        !draft.trim() ||
                        selectedConversation.status === 'resolved'
                      }
                      className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-sm font-bold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {sending ? (
                        <LoaderCircle size={16} className="animate-spin" />
                      ) : (
                        <Send size={16} />
                      )}
                      Gui
                    </button>
                  </div>
                </form>
              </div>
            </>
          ) : (
            <div className="flex min-h-[62vh] items-center justify-center px-6 text-center text-sm text-on-surface-variant">
              Chon mot cuoc tro chuyen o cot ben trai de bat dau ho tro.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function StatusPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: 'amber' | 'emerald' | 'sky';
}) {
  const toneMap = {
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    sky: 'bg-sky-50 text-sky-700 border-sky-200',
  };

  return (
    <div className={`rounded-2xl border px-4 py-3 ${toneMap[tone]}`}>
      <p className="text-[11px] font-bold uppercase tracking-[0.2em]">
        {label}
      </p>
      <p className="mt-1 text-lg font-black">{value}</p>
    </div>
  );
}
