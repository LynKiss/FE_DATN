import {
  LoaderCircle,
  MessageCircleMore,
  RefreshCw,
  Search,
  Send,
} from 'lucide-react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { useAdminSession } from '../hooks/useAdminSession';
import { useToast } from '../hooks/useToast';
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
  meta: { page: number; limit: number; total: number; totalPages: number };
  items: SupportConversation[];
};

function upsertConversation(current: SupportConversation[], incoming: SupportConversation) {
  const next = current.some((c) => c.conversationId === incoming.conversationId)
    ? current.map((c) => (c.conversationId === incoming.conversationId ? incoming : c))
    : [incoming, ...current];
  return sortSupportConversations(next);
}

function appendMessage(current: SupportMessage[], incoming: SupportMessage) {
  if (current.some((m) => m.messageId === incoming.messageId)) return current;
  return [...current, incoming].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

function formatTime(value: string | null) {
  if (!value) return 'Vừa tạo';
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(value));
}

function unwrapSocketPayload<T>(payload: T | { data: T }) {
  if (payload && typeof payload === 'object' && 'data' in payload && payload.data) {
    return payload.data;
  }
  return payload as T;
}

export default function SupportChats() {
  const { session } = useAdminSession();
  const { showToast } = useToast();

  const [conversations, setConversations] = useState<SupportConversation[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedConv, setSelectedConv] = useState<SupportConversation | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [startingConv, setStartingConv] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [draft, setDraft] = useState('');
  const [customerLookup, setCustomerLookup] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | SupportConversationStatus>('all');
  const [page, setPage] = useState(1);
  const limit = 50;

  const socketRef = useRef<ReturnType<typeof createSupportChatSocket> | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const joinedIdRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedId]);

  async function loadConversations(opts?: { silent?: boolean }) {
    if (!opts?.silent) setLoading(true);
    const q = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search.trim()) q.set('search', search.trim());
    if (statusFilter !== 'all') q.set('status', statusFilter);
    try {
      const res = await apiClient.get<SupportConversationsResponse>(
        `/support-chat/admin/conversations?${q.toString()}`,
      );
      setConversations(res.items);
      setMeta(res.meta);
      if (!selectedIdRef.current || !res.items.some((c) => c.conversationId === selectedIdRef.current)) {
        setSelectedId(res.items[0]?.conversationId ?? null);
      }
    } catch (err) {
      if (!opts?.silent) {
        showToast({ tone: 'error', title: 'Không tải được danh sách chat', description: err instanceof Error ? err.message : '' });
      }
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }

  async function loadDetail(conversationId: string, opts?: { silent?: boolean }) {
    if (!opts?.silent) setMessagesLoading(true);
    try {
      const [conv, history] = await Promise.all([
        apiClient.patch<SupportConversation>(`/support-chat/conversations/${conversationId}/read`),
        apiClient.get<SupportMessage[]>(`/support-chat/conversations/${conversationId}/messages?limit=100`),
      ]);
      setSelectedConv(conv);
      setMessages(history);
      setConversations((prev) => upsertConversation(prev, conv));
    } catch (err) {
      if (!opts?.silent) {
        showToast({ tone: 'error', title: 'Không tải được hội thoại', description: err instanceof Error ? err.message : '' });
      }
    } finally {
      if (!opts?.silent) setMessagesLoading(false);
    }
  }

  useEffect(() => {
    if (!session?.accessToken) return;
    void loadConversations();
  }, [limit, page, search, session?.accessToken, statusFilter]);

  useEffect(() => {
    if (!selectedId) { setSelectedConv(null); setMessages([]); return; }
    if (socketRef.current && joinedIdRef.current && joinedIdRef.current !== selectedId) {
      socketRef.current.emit('conversation:leave', { conversationId: joinedIdRef.current });
    }
    if (socketRef.current?.connected) {
      socketRef.current.emit('conversation:join', { conversationId: selectedId });
      joinedIdRef.current = selectedId;
    }
    void loadDetail(selectedId);
  }, [selectedId]);

  useEffect(() => {
    if (!session?.accessToken) return;
    const socket = createSupportChatSocket(session.accessToken);
    socketRef.current = socket;

    socket.on('connect', () => {
      setSocketConnected(true);
      if (selectedIdRef.current) {
        socket.emit('conversation:join', { conversationId: selectedIdRef.current });
        joinedIdRef.current = selectedIdRef.current;
      }
    });
    socket.on('disconnect', () => setSocketConnected(false));
    socket.on('support:error', (p: { message?: string }) => {
      if (p?.message) showToast({ tone: 'error', title: 'Socket chat lỗi', description: p.message });
    });
    socket.on('support:conversation', (incoming: SupportConversation) => {
      setConversations((prev) => upsertConversation(prev, incoming));
      setSelectedConv((prev) => prev?.conversationId === incoming.conversationId ? incoming : prev);
    });
    socket.on('support:message', (p: { conversationId: string; message: SupportMessage }) => {
      if (p.conversationId !== selectedIdRef.current) return;
      setMessages((prev) => appendMessage(prev, p.message));
      if (p.message.senderRole === 'customer') {
        socket.emit('conversation:read', { conversationId: p.conversationId });
      }
    });
    socket.on(
      'conversation:joined',
      (p: { conversation: SupportConversation; messages: SupportMessage[] } | { data: { conversation: SupportConversation; messages: SupportMessage[] } }) => {
        const r = unwrapSocketPayload(p);
        if (r.conversation.conversationId !== selectedIdRef.current) return;
        setSelectedConv(r.conversation);
        setConversations((prev) => upsertConversation(prev, r.conversation));
        setMessages(r.messages);
        setMessagesLoading(false);
      },
    );
    socket.on('conversation:read', (p: SupportConversation | { data: SupportConversation }) => {
      const r = unwrapSocketPayload(p);
      setSelectedConv((prev) => prev?.conversationId === r.conversationId ? r : prev);
      setConversations((prev) => upsertConversation(prev, r));
    });

    return () => { socket.removeAllListeners(); socket.disconnect(); socketRef.current = null; setSocketConnected(false); };
  }, [session?.accessToken, showToast]);

  useEffect(() => {
    if (socketConnected) return;
    const id = window.setInterval(() => {
      void loadConversations({ silent: true });
      if (selectedIdRef.current) void loadDetail(selectedIdRef.current, { silent: true });
    }, 4000);
    return () => window.clearInterval(id);
  }, [socketConnected, limit, page, search, statusFilter]);

  const waitingStaffCount = useMemo(
    () => conversations.filter((c) => c.status === 'waiting_staff').length,
    [conversations],
  );
  const unresolvedCount = useMemo(
    () => conversations.filter((c) => c.status !== 'resolved').length,
    [conversations],
  );

  async function handleStartConversation(event: FormEvent) {
    event.preventDefault();
    if (!customerLookup.trim()) return;
    setStartingConv(true);
    try {
      const conv = await apiClient.post<SupportConversation>('/support-chat/admin/conversations/start', {
        customerLookup: customerLookup.trim(),
      });
      setConversations((prev) => upsertConversation(prev, conv));
      setSelectedId(conv.conversationId);
      setCustomerLookup('');
      showToast({ tone: 'success', title: 'Đã mở cuộc trò chuyện' });
    } catch (err) {
      showToast({ tone: 'error', title: 'Không thể mở cuộc trò chuyện', description: err instanceof Error ? err.message : '' });
    } finally {
      setStartingConv(false);
    }
  }

  async function handleAssign() {
    if (!selectedConv) return;
    try {
      const conv = await apiClient.patch<SupportConversation>(
        `/support-chat/admin/conversations/${selectedConv.conversationId}/assign`,
      );
      setSelectedConv(conv);
      setConversations((prev) => upsertConversation(prev, conv));
      showToast({ tone: 'success', title: 'Đã nhận cuộc trò chuyện' });
    } catch (err) {
      showToast({ tone: 'error', title: 'Nhận cuộc trò chuyện thất bại', description: err instanceof Error ? err.message : '' });
    }
  }

  async function handleUpdateStatus(status: SupportConversationStatus) {
    if (!selectedConv) return;
    try {
      const conv = await apiClient.patch<SupportConversation>(
        `/support-chat/admin/conversations/${selectedConv.conversationId}/status`,
        { status },
      );
      setSelectedConv(conv);
      setConversations((prev) => upsertConversation(prev, conv));
      showToast({ tone: 'success', title: status === 'resolved' ? 'Đã đóng cuộc trò chuyện' : 'Đã mở lại cuộc trò chuyện' });
    } catch (err) {
      showToast({ tone: 'error', title: 'Cập nhật trạng thái thất bại', description: err instanceof Error ? err.message : '' });
    }
  }

  async function handleSendMessage(event: FormEvent) {
    event.preventDefault();
    if (!selectedId || !draft.trim()) return;
    const content = draft.trim();
    setSending(true);
    setDraft('');
    try {
      if (socketRef.current?.connected) {
        socketRef.current.emit('message:send', { conversationId: selectedId, content });
      } else {
        const result = await apiClient.post<{ conversation: SupportConversation; message: SupportMessage }>(
          `/support-chat/conversations/${selectedId}/messages`,
          { content },
        );
        setSelectedConv(result.conversation);
        setConversations((prev) => upsertConversation(prev, result.conversation));
        setMessages((prev) => appendMessage(prev, result.message));
      }
    } catch (err) {
      setDraft(content);
      showToast({ tone: 'error', title: 'Gửi tin nhắn thất bại', description: err instanceof Error ? err.message : '' });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-5 pb-12">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-primary">
            Chat hỗ trợ khách hàng
          </h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Theo dõi và phản hồi hội thoại với khách hàng theo thời gian thực.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill label="Đang chờ NV" value={waitingStaffCount} tone="amber" />
          <StatusPill label="Chưa xử lý" value={unresolvedCount} tone="sky" />
          <StatusPill
            label={socketConnected ? 'Socket' : 'Polling'}
            value={socketConnected ? 'Live' : '4s'}
            tone={socketConnected ? 'emerald' : 'amber'}
          />
        </div>
      </div>

      <section className="rounded-[2rem] border border-on-surface/8 bg-white p-5 shadow-sm">
        <form onSubmit={handleStartConversation} className="grid gap-3 lg:grid-cols-[1fr_auto]">
          <label className="relative">
            <Search size={15} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40" />
            <input
              value={customerLookup}
              onChange={(e) => setCustomerLookup(e.target.value)}
              placeholder="userId / username / email để mở hội thoại mới..."
              className="w-full rounded-2xl border border-on-surface/10 bg-surface py-3 pl-11 pr-4 text-sm outline-none focus:border-primary/40"
            />
          </label>
          <button
            type="submit"
            disabled={startingConv || !customerLookup.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {startingConv ? <LoaderCircle size={15} className="animate-spin" /> : <MessageCircleMore size={15} />}
            Mở hội thoại
          </button>
        </form>
        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_200px_auto]">
          <label className="relative">
            <Search size={15} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40" />
            <input
              value={search}
              onChange={(e) => { setPage(1); setSearch(e.target.value); }}
              placeholder="Tìm theo mã, username, email..."
              className="w-full rounded-2xl border border-on-surface/10 bg-surface py-3 pl-11 pr-4 text-sm outline-none focus:border-primary/40"
            />
          </label>
          <select
            value={statusFilter}
            onChange={(e) => { setPage(1); setStatusFilter(e.target.value as 'all' | SupportConversationStatus); }}
            className="rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="waiting_staff">Đang chờ nhân viên</option>
            <option value="waiting_customer">Đang chờ khách</option>
            <option value="resolved">Đã xử lý</option>
          </select>
          <button
            type="button"
            onClick={() => { setPage(1); setSearch(''); setStatusFilter('all'); }}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-on-surface/10 px-4 py-3 text-sm font-semibold text-on-surface-variant transition hover:border-primary/30 hover:text-primary"
          >
            <RefreshCw size={15} />
            Đặt lại
          </button>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <section
          className="flex flex-col overflow-hidden rounded-[2rem] border border-on-surface/8 bg-white shadow-sm"
          style={{ maxHeight: '74vh' }}
        >
          <div className="shrink-0 border-b border-on-surface/8 px-5 py-4">
            <p className="font-black text-on-surface">Danh sách hội thoại</p>
            <p className="text-xs text-on-surface-variant">
              {loading ? 'Đang tải...' : `${meta.total} cuộc trò chuyện`}
            </p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <LoaderCircle size={20} className="animate-spin text-primary" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="px-6 py-16 text-center text-sm text-on-surface-variant">
                Không có cuộc trò chuyện nào khớp bộ lọc hiện tại.
              </div>
            ) : (
              conversations.map((conv) => {
                const isActive = conv.conversationId === selectedId;
                const initials = conv.customer.username.slice(0, 2).toUpperCase();
                return (
                  <button
                    key={conv.conversationId}
                    type="button"
                    onClick={() => setSelectedId(conv.conversationId)}
                    className={`flex w-full items-start gap-3 border-b border-on-surface/5 px-4 py-4 text-left transition ${
                      isActive ? 'bg-primary/5' : 'hover:bg-surface'
                    }`}
                  >
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                        isActive ? 'bg-primary text-white' : 'bg-primary/10 text-primary'
                      }`}
                    >
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-sm font-bold text-on-surface">{conv.customer.username}</p>
                        <span className="shrink-0 text-[10px] text-on-surface-variant/60">
                          {formatTime(conv.lastMessageAt ?? conv.createdAt)}
                        </span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${SUPPORT_STATUS_STYLES[conv.status]}`}>
                          {SUPPORT_STATUS_LABELS[conv.status]}
                        </span>
                        {conv.staffUnreadCount > 0 && (
                          <span className="inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white">
                            {conv.staffUnreadCount}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 line-clamp-1 text-xs text-on-surface-variant/70">
                        {conv.lastMessagePreview ?? 'Chưa có tin nhắn...'}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>

        </section>

        <section
          className="flex flex-col overflow-hidden rounded-[2rem] border border-on-surface/8 bg-white shadow-sm"
          style={{ maxHeight: '74vh' }}
        >
          {selectedConv ? (
            <>
              <div className="shrink-0 border-b border-on-surface/8 px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-sm font-black text-primary">
                      {selectedConv.customer.username.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-black text-on-surface">{selectedConv.customer.username}</p>
                      <p className="text-xs text-on-surface-variant">
                        {selectedConv.customer.email ?? selectedConv.customer._id}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${SUPPORT_STATUS_STYLES[selectedConv.status]}`}>
                      {SUPPORT_STATUS_LABELS[selectedConv.status]}
                    </span>
                    <span className="inline-flex rounded-full bg-surface px-2.5 py-1 text-xs text-on-surface-variant">
                      {selectedConv.assignedStaff ? `NV: ${selectedConv.assignedStaff.username}` : 'Chưa có NV'}
                    </span>
                    {!selectedConv.assignedStaff && (
                      <button
                        type="button"
                        onClick={() => void handleAssign()}
                        className="rounded-full border border-primary/20 bg-primary/8 px-3 py-1 text-xs font-semibold text-primary transition hover:bg-primary/12"
                      >
                        Nhận trò chuyện
                      </button>
                    )}
                    {selectedConv.status !== 'resolved' ? (
                      <button
                        type="button"
                        onClick={() => void handleUpdateStatus('resolved')}
                        className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                      >
                        Đánh dấu xử lý xong
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handleUpdateStatus('waiting_staff')}
                        className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 transition hover:bg-amber-100"
                      >
                        Mở lại hội thoại
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto bg-[#f7f5f1] px-5 py-5">
                {messagesLoading ? (
                  <div className="flex h-full items-center justify-center">
                    <LoaderCircle size={20} className="animate-spin text-primary/40" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-on-surface-variant">
                    <MessageCircleMore size={28} className="text-primary/20" />
                    <p className="text-sm">Chưa có tin nhắn nào. Hãy bắt đầu phản hồi khách hàng.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((msg) => {
                      const isStaff = msg.senderRole === 'staff';
                      return (
                        <div
                          key={msg.messageId}
                          className={`flex items-end gap-2 ${isStaff ? 'flex-row-reverse' : 'flex-row'}`}
                        >
                          <div
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[9px] font-black ${
                              isStaff ? 'bg-primary text-white' : 'bg-white text-primary shadow-sm'
                            }`}
                          >
                            {msg.sender.username.slice(0, 2).toUpperCase()}
                          </div>
                          <div className={`flex max-w-[70%] flex-col gap-1 ${isStaff ? 'items-end' : 'items-start'}`}>
                            <div
                              className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
                                isStaff
                                  ? 'rounded-br-sm bg-primary text-white'
                                  : 'rounded-bl-sm bg-white text-on-surface'
                              }`}
                            >
                              {msg.content}
                            </div>
                            <p className="text-[10px] text-on-surface-variant/60">
                              {msg.sender.username} · {formatTime(msg.createdAt)}
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
                onSubmit={(e) => void handleSendMessage(e)}
                className="shrink-0 border-t border-on-surface/8 bg-white px-5 py-4"
              >
                <div className="flex items-end gap-3">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={2}
                    placeholder={
                      selectedConv.status === 'resolved'
                        ? 'Hội thoại đã đóng — mở lại để phản hồi.'
                        : 'Nhập phản hồi cho khách hàng...'
                    }
                    disabled={selectedConv.status === 'resolved'}
                    className="min-h-[58px] flex-1 resize-none rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none transition focus:border-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={sending || !draft.trim() || selectedConv.status === 'resolved'}
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-white transition hover:bg-primary/90 disabled:opacity-50"
                  >
                    {sending ? <LoaderCircle size={16} className="animate-spin" /> : <Send size={16} />}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-on-surface-variant">
              <MessageCircleMore size={36} className="text-primary/20" />
              <p className="text-sm">Chọn một cuộc trò chuyện ở bên trái để bắt đầu hỗ trợ.</p>
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
    <div className={`rounded-2xl border px-4 py-2.5 ${toneMap[tone]}`}>
      <p className="text-[10px] font-bold uppercase tracking-[0.2em]">{label}</p>
      <p className="mt-0.5 text-lg font-black">{value}</p>
    </div>
  );
}
