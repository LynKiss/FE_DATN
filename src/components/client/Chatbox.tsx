import {
  ChevronDown,
  Leaf,
  LoaderCircle,
  LogIn,
  MessageCircle,
  RefreshCw,
  Send,
  X,
} from 'lucide-react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useClientSession } from '../../hooks/useClientSession';
import { useToast } from '../../hooks/useToast';
import { clientApi } from '../../lib/client-api';
import {
  SUPPORT_STATUS_LABELS,
  SUPPORT_STATUS_STYLES,
  type SupportConversation,
  type SupportMessage,
  createSupportChatSocket,
  sortSupportConversations,
} from '../../lib/support-chat';

type BotTab = 'bot' | 'support';

type SupportBotProductSuggestion = {
  productId: string;
  productName: string;
  effectivePrice: string;
  basePrice: string;
  unit: string | null;
  quantityAvailable: number;
  primaryImageUrl: string | null;
};

type SupportBotReply = {
  reply: string;
  source: 'ai' | 'fallback';
  handoffSuggested: boolean;
  products: SupportBotProductSuggestion[];
  intent: string;
};

type BotMessage = {
  id: number;
  from: 'user' | 'bot';
  text: string;
  products?: SupportBotProductSuggestion[];
};

const FAQ_RESPONSES: Record<string, string> = {
  'giao hàng':
    'Chúng tôi giao hàng toàn quốc trong 2-4 ngày làm việc. Miễn phí vận chuyển cho đơn từ 500.000đ.',
  'vận chuyển':
    'Phí vận chuyển từ 25.000đ tùy khu vực. Đơn từ 500.000đ được miễn phí ship toàn quốc.',
  'đổi trả':
    'Bạn có thể đổi trả sản phẩm trong vòng 7 ngày kể từ ngày nhận hàng nếu sản phẩm bị lỗi hoặc không đúng mô tả. Cần giữ nguyên bao bì + hóa đơn.',
  'hoàn tiền':
    'Hoàn tiền được xử lý trong 3-5 ngày làm việc sau khi đơn được duyệt trả hàng. Tiền sẽ về phương thức thanh toán ban đầu.',
  'thanh toán':
    'Chúng tôi hỗ trợ: COD (trả khi nhận), chuyển khoản ngân hàng, ví MoMo, VNPay, ZaloPay.',
  'phân bón':
    'Chúng tôi có đủ phân bón hữu cơ, phân NPK và phân vi sinh. Bạn có thể lọc theo "Phân bón" trong trang Sản phẩm.',
  'thuốc':
    'Chúng tôi bán thuốc bảo vệ thực vật chính hãng và có đầy đủ giấy phép lưu hành.',
  'hạt giống':
    'Có đủ hạt giống lúa, rau màu, cây ăn quả. Tỷ lệ nảy mầm trên 90%, có giấy chứng nhận từ viện giống.',
  'dụng cụ':
    'Có đầy đủ dụng cụ nông nghiệp: cuốc, xẻng, máy cày, bình phun, hệ thống tưới...',
  'liên hệ':
    'Hotline: 1800 6863 (miễn phí). Email: support@cultivatedledger.vn. Giờ làm việc: 7:00 - 21:00 mỗi ngày.',
  'hotline':
    'Gọi ngay 1800 6863 (miễn phí). Hỗ trợ 7-21h hàng ngày.',
  'khuyến mãi':
    'Cửa hàng thường xuyên có giảm giá. Xem ở trang chủ hoặc lọc "Đang giảm giá" trong trang Sản phẩm.',
  'tài khoản':
    'Bạn có thể đăng ký miễn phí ở góc trên phải. Tài khoản giúp lưu địa chỉ, theo dõi đơn hàng và tích điểm.',
  'đăng ký':
    'Bấm "Đăng ký" ở góc phải. Cần email + số điện thoại. Hoặc bạn có thể mua hàng theo dạng khách vãng lai (không cần đăng ký).',
  'kho':
    'Hệ thống kho trải khắp 3 miền. Đơn từ HCM, HN, ĐN giao trong 1-2 ngày, các tỉnh khác 2-4 ngày.',
  'bảo hành':
    'Sản phẩm có bảo hành theo nhà sản xuất. Vui lòng giữ hóa đơn để được hỗ trợ tốt nhất.',
};

const BOT_WELCOME =
  'Xin chào. Tôi là chatbot hỗ trợ của Cultivated Ledger. Tôi có thể trả lời nhanh về giao hàng, đổi trả, thanh toán và thông tin liên hệ.';

const QUICK_QUESTIONS = [
  'Chính sách giao hàng?',
  'Tra cứu đơn hàng',
  'Đổi trả như thế nào?',
  'Các hình thức thanh toán?',
  'Tìm sản phẩm',
  'Hotline liên hệ?',
];

let botMessageIdCounter = 2;

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

  return [...current, incoming].sort(
    (left, right) =>
      Date.parse(left.createdAt) - Date.parse(right.createdAt),
  );
}

function formatMessageTime(value: string | null) {
  if (!value) {
    return '';
  }

  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

async function getBotResponse(text: string): Promise<string> {
  const lower = text.toLowerCase().trim();

  // 1. Order tracking — pattern "tra cứu đơn", "đơn hàng X", "ORD-...", UUID
  const uuidMatch = text.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
  );
  if (
    uuidMatch ||
    lower.includes('tra cứu đơn') ||
    lower.includes('đơn hàng của tôi') ||
    lower.includes('mã đơn')
  ) {
    if (uuidMatch) {
      try {
        const order = await clientApi.get<any>(`/orders/${uuidMatch[0]}`);
        const STATUS_VI: Record<string, string> = {
          pending: '⏳ Chờ xử lý',
          backordered: '📦 Chờ hàng',
          confirmed: '✅ Đã xác nhận',
          processing: '🔄 Đang xử lý',
          shipping: '🚚 Đang giao',
          delivered: '🎉 Đã giao',
          partial_delivered: '📦 Giao một phần',
          cancelled: '❌ Đã hủy',
          returned: '↩️ Đã hoàn',
        };
        return [
          `Đơn hàng ${order.id?.slice(0, 8) ?? '...'}`,
          `Trạng thái: ${STATUS_VI[order.status] ?? order.status}`,
          `Tổng tiền: ${Number(order.totalPayment).toLocaleString('vi-VN')}₫`,
          `Số lượng: ${order.totalQuantity} sản phẩm`,
          `Người nhận: ${order.fullName} - ${order.phone}`,
        ].join('\n');
      } catch {
        return 'Không tìm thấy đơn hàng với mã này. Vui lòng kiểm tra lại hoặc đăng nhập để xem danh sách đơn của bạn.';
      }
    }
    return '📋 Bạn có thể:\n• Đăng nhập rồi vào "Đơn hàng của tôi"\n• Gửi tôi mã đơn (UUID) để tra cứu nhanh\n• Hoặc gọi 1800 6863 để được hỗ trợ.';
  }

  // 2. Product search
  if (lower.includes('tìm sản phẩm') || lower.includes('tìm kiếm') || lower.startsWith('tìm ')) {
    const query = text.replace(/tìm (sản phẩm|kiếm)?/gi, '').trim();
    if (query.length < 2) {
      return 'Bạn muốn tìm sản phẩm gì? Hãy nhập tên sản phẩm bạn cần (VD: "tìm phân NPK").';
    }
    try {
      const data = await clientApi.get<{ items: any[] }>(
        `/products?search=${encodeURIComponent(query)}&limit=5&includeHidden=false`,
      );
      const items = data.items ?? [];
      if (items.length === 0) {
        return `Không tìm thấy sản phẩm nào khớp với "${query}". Bạn có thể vào trang Sản phẩm để xem danh mục đầy đủ.`;
      }
      const list = items
        .slice(0, 5)
        .map(
          (p, i) =>
            `${i + 1}. ${p.productName} — ${Number(p.effectivePrice ?? p.basePrice).toLocaleString('vi-VN')}₫`,
        )
        .join('\n');
      return `🔍 Tìm thấy ${items.length} sản phẩm:\n${list}\n\nXem chi tiết tại trang Sản phẩm.`;
    } catch {
      return 'Không tải được kết quả tìm kiếm. Vui lòng thử lại sau.';
    }
  }

  // 3. FAQ keyword match
  for (const [keyword, response] of Object.entries(FAQ_RESPONSES)) {
    if (lower.includes(keyword)) {
      return response;
    }
  }

  // 4. Greetings
  if (/^(xin chào|hello|hi|chào|hey)/.test(lower)) {
    return 'Chào bạn! Tôi có thể giúp gì? Bạn có thể hỏi về giao hàng, đổi trả, thanh toán, hoặc gửi mã đơn để tra cứu.';
  }

  // 5. Default fallback
  return [
    'Tôi chưa hiểu câu hỏi của bạn 😊',
    '',
    'Tôi có thể giúp:',
    '• Trả lời FAQ (giao hàng, đổi trả, thanh toán, ...)',
    '• Tra cứu đơn hàng (gửi tôi mã đơn UUID)',
    '• Tìm sản phẩm ("tìm phân NPK")',
    '• Chuyển sang tab "Nhân viên" để chat trực tiếp với CSKH',
  ].join('\n');
}

function buildBotHistory(messages: BotMessage[]) {
  return messages.slice(-10).map((message) => ({
    role: message.from === 'user' ? 'user' : 'assistant',
    content: message.text,
  }));
}

function formatBotCurrency(value: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return value;
  }

  return `${amount.toLocaleString('vi-VN')}đ`;
}

export default function Chatbox() {
  const { session } = useClientSession();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<BotTab>('bot');

  const [botMessages, setBotMessages] = useState<BotMessage[]>([
    { id: 1, from: 'bot', text: BOT_WELCOME },
  ]);
  const [botInput, setBotInput] = useState('');
  const [botTyping, setBotTyping] = useState(false);
  const [botUnreadCount, setBotUnreadCount] = useState(0);

  const [conversations, setConversations] = useState<SupportConversation[]>([]);
  const [conversation, setConversation] = useState<SupportConversation | null>(
    null,
  );
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);

  const socketRef = useRef<ReturnType<typeof createSupportChatSocket> | null>(
    null,
  );
  const currentConversationIdRef = useRef<string | null>(null);
  const openRef = useRef(false);
  const activeTabRef = useRef<BotTab>('bot');
  const supportMessagesEndRef = useRef<HTMLDivElement | null>(null);
  const botMessagesEndRef = useRef<HTMLDivElement | null>(null);
  const botTimerRef = useRef<number | null>(null);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    activeTabRef.current = activeTab;

    if (open && activeTab === 'bot') {
      setBotUnreadCount(0);
    }
  }, [activeTab, open]);

  useEffect(() => {
    const handleOpenRequest = (event: Event) => {
      const detail =
        event instanceof CustomEvent
          ? (event.detail as { tab?: BotTab } | undefined)
          : undefined;

      setOpen(true);
      setActiveTab(detail?.tab === 'support' ? 'support' : 'bot');
    };

    window.addEventListener('support-chat:open', handleOpenRequest as EventListener);
    return () =>
      window.removeEventListener(
        'support-chat:open',
        handleOpenRequest as EventListener,
      );
  }, []);

  useEffect(() => {
    currentConversationIdRef.current = conversation?.conversationId ?? null;
  }, [conversation?.conversationId]);

  useEffect(() => {
    if (open && activeTab === 'bot') {
      botMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeTab, botMessages, open]);

  useEffect(() => {
    if (open && activeTab === 'support') {
      supportMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeTab, messages, open]);

  useEffect(() => {
    if (!session?.accessToken) {
      setConversations([]);
      setConversation(null);
      setMessages([]);
      socketRef.current?.disconnect();
      socketRef.current = null;
      setSocketConnected(false);
      return;
    }

    let cancelled = false;
    void clientApi
      .get<SupportConversation[]>('/support-chat/conversations/me')
      .then((items) => {
        if (!cancelled) {
          setConversations(sortSupportConversations(items));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setConversations([]);
        }
      });

    const socket = createSupportChatSocket(session.accessToken);
    socketRef.current = socket;

    socket.on('connect', () => {
      setSocketConnected(true);

      if (currentConversationIdRef.current) {
        socket.emit('conversation:join', {
          conversationId: currentConversationIdRef.current,
        });
      }
    });

    socket.on('disconnect', () => {
      setSocketConnected(false);
    });

    socket.on('support:error', (payload: { message?: string }) => {
      if (payload?.message) {
        showToast({
          tone: 'error',
          title: 'Chat hỗ trợ gặp lỗi',
          description: payload.message,
        });
      }
    });

    socket.on('support:conversation', (incoming: SupportConversation) => {
      setConversations((current) => upsertConversation(current, incoming));
      setConversation((current) =>
        current?.conversationId === incoming.conversationId ? incoming : current,
      );
    });

    socket.on(
      'support:message',
      (payload: { conversationId: string; message: SupportMessage }) => {
        if (payload.conversationId !== currentConversationIdRef.current) {
          return;
        }

        setMessages((current) => appendMessage(current, payload.message));

        if (
          openRef.current &&
          activeTabRef.current === 'support' &&
          socketRef.current?.connected
        ) {
          socketRef.current.emit('conversation:read', {
            conversationId: payload.conversationId,
          });
          return;
        }

        if (
          openRef.current &&
          activeTabRef.current === 'support' &&
          !socketRef.current?.connected
        ) {
          void clientApi
            .patch<SupportConversation>(
              `/support-chat/conversations/${payload.conversationId}/read`,
            )
            .then((nextConversation) => {
              setConversation(nextConversation);
              setConversations((current) =>
                upsertConversation(current, nextConversation),
              );
            })
            .catch(() => {
              /* ignore disconnected read sync */
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
        const resolved = 'data' in payload ? payload.data : payload;
        if (
          resolved.conversation.conversationId === currentConversationIdRef.current
        ) {
          setConversation(resolved.conversation);
          setConversations((current) =>
            upsertConversation(current, resolved.conversation),
          );
          setMessages(resolved.messages);
        }
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
        const resolved = 'data' in payload ? payload.data : payload;
        setConversation((current) =>
          current?.conversationId === resolved.conversationId
            ? resolved
            : current,
        );
        setConversations((current) => upsertConversation(current, resolved));
      },
    );

    return () => {
      cancelled = true;
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setSocketConnected(false);
    };
  }, [session?.accessToken, showToast]);

  useEffect(() => {
    if (open && activeTab === 'support' && session) {
      void ensureConversation();
    }
  }, [activeTab, open, session]);

  useEffect(() => {
    if (
      !open ||
      activeTab !== 'support' ||
      !conversation?.conversationId ||
      socketConnected
    ) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void Promise.all([
        clientApi.patch<SupportConversation>(
          `/support-chat/conversations/${conversation.conversationId}/read`,
        ),
        clientApi.get<SupportMessage[]>(
          `/support-chat/conversations/${conversation.conversationId}/messages?limit=100`,
        ),
      ])
        .then(([nextConversation, history]) => {
          setConversation(nextConversation);
          setConversations((current) =>
            upsertConversation(current, nextConversation),
          );
          setMessages(history);
        })
        .catch(() => {
          /* keep silent while polling fallback is active */
        });
    }, 4000);

    return () => window.clearInterval(intervalId);
  }, [activeTab, conversation?.conversationId, open, socketConnected]);

  useEffect(() => {
    return () => {
      if (botTimerRef.current) {
        window.clearTimeout(botTimerRef.current);
      }
    };
  }, []);

  const supportUnreadCount = useMemo(
    () =>
      conversations.reduce(
        (total, item) => total + (item.customerUnreadCount ?? 0),
        0,
      ),
    [conversations],
  );
  const totalUnreadCount = supportUnreadCount + botUnreadCount;
  const requireLogin = !session;

  async function ensureConversation() {
    if (!session) {
      return;
    }

    setLoading(true);

    try {
      const activeConversation = await clientApi.post<SupportConversation>(
        '/support-chat/conversations/me/start',
      );

      setConversation(activeConversation);
      setConversations((current) =>
        upsertConversation(current, activeConversation),
      );

      if (socketRef.current?.connected) {
        socketRef.current.emit('conversation:join', {
          conversationId: activeConversation.conversationId,
        });
        socketRef.current.emit('conversation:read', {
          conversationId: activeConversation.conversationId,
        });
      }

      const [readConversation, history] = await Promise.all([
        clientApi.patch<SupportConversation>(
          `/support-chat/conversations/${activeConversation.conversationId}/read`,
        ),
        clientApi.get<SupportMessage[]>(
          `/support-chat/conversations/${activeConversation.conversationId}/messages?limit=100`,
        ),
      ]);

      setConversation(readConversation);
      setConversations((current) =>
        upsertConversation(current, readConversation),
      );
      setMessages(history);
    } catch (error) {
      showToast({
        tone: 'error',
        title: 'Không thể mở chat hỗ trợ',
        description: error instanceof Error ? error.message : '',
      });
    } finally {
      setLoading(false);
    }
  }

  function handleSendBotMessage(rawText: string) {
    const text = rawText.trim();

    if (!text) {
      return;
    }

    const userMessage: BotMessage = {
      id: botMessageIdCounter++,
      from: 'user',
      text,
    };
    const history = buildBotHistory([...botMessages, userMessage]);

    setBotMessages((current) => [...current, userMessage]);
    setBotInput('');
    setBotTyping(true);

    if (botTimerRef.current) {
      window.clearTimeout(botTimerRef.current);
    }

    botTimerRef.current = window.setTimeout(() => {
      void (async () => {
        try {
          const response = await clientApi.post<SupportBotReply>(
            '/support-chat/bot/reply',
            {
              message: text,
              history,
            },
          );
          const reply: BotMessage = {
            id: botMessageIdCounter++,
            from: 'bot',
            text: response.reply,
            products: response.products ?? [],
          };
          setBotMessages((current) => [...current, reply]);

          if (!openRef.current || activeTabRef.current !== 'bot') {
            setBotUnreadCount((current) => current + 1);
          }
        } catch {
          const fallbackText = await getBotResponse(text);
          const fallbackReply: BotMessage = {
            id: botMessageIdCounter++,
            from: 'bot',
            text: fallbackText,
          };
          setBotMessages((current) => [...current, fallbackReply]);

          if (!openRef.current || activeTabRef.current !== 'bot') {
            setBotUnreadCount((current) => current + 1);
          }
        } finally {
          setBotTyping(false);
        }
      })();
    }, 700);
  }

  function handleBotSubmit(event: FormEvent) {
    event.preventDefault();
    handleSendBotMessage(botInput);
  }

  async function handleSendSupportMessage(event: FormEvent) {
    event.preventDefault();

    if (!conversation || !draft.trim()) {
      return;
    }

    const content = draft.trim();
    setSending(true);
    setDraft('');

    try {
      if (socketRef.current?.connected) {
        socketRef.current.emit('message:send', {
          conversationId: conversation.conversationId,
          content,
        });
      } else {
        const result = await clientApi.post<{
          conversation: SupportConversation;
          message: SupportMessage;
        }>(`/support-chat/conversations/${conversation.conversationId}/messages`, {
          content,
        });

        setConversation(result.conversation);
        setConversations((current) =>
          upsertConversation(current, result.conversation),
        );
        setMessages((current) => appendMessage(current, result.message));
      }
    } catch (error) {
      setDraft(content);
      showToast({
        tone: 'error',
        title: 'Gửi tin nhắn thất bại',
        description: error instanceof Error ? error.message : '',
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen((current) => !current)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-[0_0_6px_rgba(0,0,0,0.24),0_8px_12px_rgba(0,0,0,0.14)] transition-all hover:scale-105 active:scale-95"
        style={{ background: '#00754A' }}
        aria-label="Mở hộp chat"
      >
        {open ? <ChevronDown size={22} /> : <MessageCircle size={22} />}
        {!open && totalUnreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#c82014] text-[10px] font-black text-white">
            {totalUnreadCount > 9 ? '9+' : totalUnreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className="fixed bottom-24 right-6 z-50 flex w-80 flex-col overflow-hidden rounded-3xl shadow-2xl sm:w-96"
          style={{ height: '560px', maxHeight: 'calc(100vh - 120px)' }}
        >
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ background: '#1E3932' }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full"
                style={{ background: '#00754A' }}
              >
                <Leaf size={15} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">
                  Hỗ trợ Cultivated Ledger
                </p>
                <p className="flex items-center gap-1 text-[10px] text-white/60">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      activeTab === 'bot'
                        ? 'bg-green-400'
                        : socketConnected
                          ? 'bg-green-400'
                          : 'bg-amber-400'
                    }`}
                  />
                  {activeTab === 'bot'
                    ? 'Chatbot trả lời nhanh'
                    : socketConnected
                      ? 'Nhân viên đang trực'
                      : 'Đang đồng bộ lại'}
                </p>
              </div>
            </div>

            <button
              onClick={() => setOpen(false)}
              className="flex h-7 w-7 items-center justify-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>

          <div className="grid grid-cols-2 border-b border-black/5 bg-white px-3 py-2">
            <button
              type="button"
              onClick={() => setActiveTab('bot')}
              className={`rounded-2xl px-3 py-2 text-sm font-bold transition ${
                activeTab === 'bot'
                  ? 'bg-[#d4e9e2] text-[#006241]'
                  : 'text-gray-500 hover:bg-[#f2f0eb]'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                Chat bot
                {botUnreadCount > 0 ? (
                  <span className="rounded-full bg-[#c82014] px-2 py-0.5 text-[10px] text-white">
                    {botUnreadCount}
                  </span>
                ) : null}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('support')}
              className={`rounded-2xl px-3 py-2 text-sm font-bold transition ${
                activeTab === 'support'
                  ? 'bg-[#d4e9e2] text-[#006241]'
                  : 'text-gray-500 hover:bg-[#f2f0eb]'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                Nhân viên
                {supportUnreadCount > 0 ? (
                  <span className="rounded-full bg-[#c82014] px-2 py-0.5 text-[10px] text-white">
                    {supportUnreadCount}
                  </span>
                ) : null}
              </span>
            </button>
          </div>

          {activeTab === 'bot' ? (
            <>
              <div className="flex-1 overflow-y-auto bg-white px-4 py-4">
                <div className="space-y-3">
                  {botMessages.map((message) => {
                    const isUser = message.from === 'user';

                    return (
                      <div
                        key={message.id}
                        className={`flex ${
                          isUser ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        <div
                          className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                            isUser
                              ? 'rounded-br-sm text-white'
                              : 'rounded-bl-sm text-[#1E3932]'
                          }`}
                          style={
                            isUser
                              ? { background: '#006241' }
                              : { background: '#f2f0eb' }
                          }
                        >
                          <p className="whitespace-pre-line">{message.text}</p>
                          {!isUser && message.products?.length ? (
                            <div className="mt-3 space-y-2">
                              {message.products.map((product) => (
                                <button
                                  key={product.productId}
                                  type="button"
                                  onClick={() => {
                                    setOpen(false);
                                    void navigate(
                                      `/client/products/${product.productId}`,
                                    );
                                  }}
                                  className="block w-full rounded-2xl border border-[#006241]/10 bg-white/75 px-3 py-2 text-left transition hover:border-[#006241]/25 hover:bg-white"
                                >
                                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#006241]/70">
                                    {product.quantityAvailable > 0
                                      ? 'Goi y san pham'
                                      : 'Tam het hang'}
                                  </p>
                                  <p className="mt-1 text-sm font-bold text-[#1E3932]">
                                    {product.productName}
                                  </p>
                                  <p className="mt-1 text-xs text-gray-500">
                                    {formatBotCurrency(product.effectivePrice)}
                                    {product.unit ? ` / ${product.unit}` : ''}
                                  </p>
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}

                  {botTyping ? (
                    <div className="flex justify-start">
                      <div
                        className="rounded-2xl rounded-bl-sm px-4 py-3"
                        style={{ background: '#f2f0eb' }}
                      >
                        <div className="flex gap-1">
                          {[0, 1, 2].map((index) => (
                            <span
                              key={index}
                              className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#006241]"
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div ref={botMessagesEndRef} />
                </div>
              </div>

              <div className="border-t border-black/5 bg-white px-3 py-2">
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {QUICK_QUESTIONS.map((question) => (
                    <button
                      key={question}
                      type="button"
                      onClick={() => handleSendBotMessage(question)}
                      className="shrink-0 rounded-full border border-[#006241]/20 px-3 py-1.5 text-[11px] font-semibold text-[#006241] transition hover:bg-[#006241]/10"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>

              <form
                onSubmit={handleBotSubmit}
                className="flex items-center gap-2 border-t border-black/5 bg-white px-3 py-2.5"
              >
                <input
                  value={botInput}
                  onChange={(event) => setBotInput(event.target.value)}
                  placeholder="Hỏi chatbot điều bạn cần..."
                  className="flex-1 rounded-full bg-[#f2f0eb] px-4 py-2 text-sm outline-none"
                />
                <button
                  type="submit"
                  disabled={!botInput.trim()}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ background: '#006241' }}
                >
                  <Send size={15} />
                </button>
              </form>
            </>
          ) : requireLogin ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-white px-6 text-center">
              <div className="rounded-full bg-[#d4e9e2] p-4 text-[#006241]">
                <MessageCircle size={26} />
              </div>
              <div>
                <p className="text-lg font-black text-[#1E3932]">
                  Đăng nhập để chat với nhân viên
                </p>
                <p className="mt-2 text-sm leading-relaxed text-gray-500">
                  Tab này lưu lịch sử chat theo tài khoản khách hàng và đồng bộ
                  phản hồi từ nhân viên theo thời gian thực.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  void navigate('/client/login', {
                    state: {
                      from: `${location.pathname}${location.search}`,
                    },
                  })
                }
                className="inline-flex items-center gap-2 rounded-full bg-[#006241] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#005237]"
              >
                <LogIn size={16} />
                Đi đến đăng nhập
              </button>
            </div>
          ) : (
            <>
              <div className="border-b border-black/5 bg-white px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  {conversation ? (
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${
                        SUPPORT_STATUS_STYLES[conversation.status]
                      }`}
                    >
                      {SUPPORT_STATUS_LABELS[conversation.status]}
                    </span>
                  ) : null}
                  <span className="inline-flex rounded-full bg-[#f2f0eb] px-2.5 py-1 text-[11px] font-semibold text-[#1E3932]">
                    {conversation?.assignedStaff
                      ? `Nhân viên: ${conversation.assignedStaff.username}`
                      : 'Chờ nhân viên nhận chat'}
                  </span>
                  <button
                    type="button"
                    onClick={() => void ensureConversation()}
                    className="ml-auto inline-flex items-center gap-1 rounded-full border border-[#006241]/15 px-2.5 py-1 text-[11px] font-semibold text-[#006241] transition hover:bg-[#006241]/8"
                  >
                    <RefreshCw size={12} />
                    Đồng bộ
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto bg-white px-4 py-4">
                {loading ? (
                  <div className="flex h-full items-center justify-center">
                    <LoaderCircle
                      size={20}
                      className="animate-spin text-[#006241]"
                    />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-center text-sm text-gray-500">
                    Bắt đầu cuộc trò chuyện với nhân viên chăm sóc khách hàng.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {messages.map((message) => {
                      const isOwn = message.senderRole === 'customer';

                      return (
                        <div
                          key={message.messageId}
                          className={`flex ${
                            isOwn ? 'justify-end' : 'justify-start'
                          }`}
                        >
                          <div
                            className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                              isOwn
                                ? 'rounded-br-sm text-white'
                                : 'rounded-bl-sm text-[#1E3932]'
                            }`}
                            style={
                              isOwn
                                ? { background: '#006241' }
                                : { background: '#f2f0eb' }
                            }
                          >
                            <p>{message.content}</p>
                            <p
                              className={`mt-2 text-[11px] ${
                                isOwn ? 'text-white/70' : 'text-gray-500'
                              }`}
                            >
                              {message.sender.username} ·{' '}
                              {formatMessageTime(message.createdAt)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={supportMessagesEndRef} />
                  </div>
                )}
              </div>

              <div className="border-t border-black/5 bg-white px-3 py-3">
                {conversation?.status === 'resolved' ? (
                  <button
                    type="button"
                    onClick={() => void ensureConversation()}
                    className="flex w-full items-center justify-center gap-2 rounded-full bg-[#006241] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#005237]"
                  >
                    <RefreshCw size={15} />
                    Tạo cuộc trò chuyện mới
                  </button>
                ) : (
                  <form
                    onSubmit={(event) => void handleSendSupportMessage(event)}
                    className="flex items-center gap-2"
                  >
                    <input
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      placeholder="Nhập tin nhắn của bạn..."
                      className="flex-1 rounded-full bg-[#f2f0eb] px-4 py-2.5 text-sm outline-none"
                    />
                    <button
                      type="submit"
                      disabled={sending || !draft.trim() || !conversation}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                      style={{ background: '#006241' }}
                    >
                      {sending ? (
                        <LoaderCircle size={15} className="animate-spin" />
                      ) : (
                        <Send size={15} />
                      )}
                    </button>
                  </form>
                )}
              </div>
            </>
          )}
        </div>
      ) : null}
    </>
  );
}
