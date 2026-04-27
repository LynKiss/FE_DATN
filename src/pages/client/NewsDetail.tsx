import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Share2, ArrowRight, Copy, Check, Facebook, MessageCircle, ThumbsUp, ThumbsDown, Send, LoaderCircle } from 'lucide-react';
import { clientApi } from '../../lib/client-api';
import { useClientSession } from '../../hooks/useClientSession';

type NewsDetail = {
  _id: string;
  title: string;
  subTitle?: string;
  slug: string;
  titleImageUrl?: string;
  content?: string;
  isPublished: boolean;
  createdAt: string;
  views: number;
  likeCount: number;
  author?: { username: string };
};

type RelatedNews = {
  _id: string;
  title: string;
  slug: string;
  titleImageUrl?: string;
  createdAt: string;
};

type NewsComment = {
  id: string;
  content: string;
  likeCount: number;
  dislikeCount: number;
  createdAt: string;
  author: { username: string };
};

const LIKED_NEWS_KEY = 'liked_news';

function getLikedNews(): string[] {
  try { return JSON.parse(localStorage.getItem(LIKED_NEWS_KEY) ?? '[]') as string[]; }
  catch { return []; }
}
function setLikedNews(ids: string[]) {
  localStorage.setItem(LIKED_NEWS_KEY, JSON.stringify(ids));
}

export default function NewsDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { session } = useClientSession();

  const [article, setArticle] = useState<NewsDetail | null>(null);
  const [related, setRelated] = useState<RelatedNews[]>([]);
  const [loading, setLoading] = useState(true);
  const [likeCount, setLikeCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [copied, setCopied] = useState(false);
  const viewTracked = useRef(false);

  // Comments
  const [comments, setComments] = useState<NewsComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentInput, setCommentInput] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [commentVotes, setCommentVotes] = useState<Record<string, 'like' | 'dislike' | null>>({});
  const [commentCounts, setCommentCounts] = useState<Record<string, { likeCount: number; dislikeCount: number }>>({});

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    viewTracked.current = false;

    void clientApi
      .get<NewsDetail>(`/news/public/by-slug/${slug}`)
      .then(async (item) => {
        setArticle(item);
        setLikeCount(item.likeCount ?? 0);
        setLiked(getLikedNews().includes(item._id));

        const rel = await clientApi
          .get<{ items?: RelatedNews[] } | RelatedNews[]>('/news/public/list?limit=4')
          .catch(() => [] as RelatedNews[]);
        const relItems = Array.isArray(rel) ? rel : ((rel as { items?: RelatedNews[] }).items ?? []);
        setRelated(relItems.filter((r) => r._id !== item._id).slice(0, 3));
      })
      .catch(() => { void navigate('/client/news'); })
      .finally(() => setLoading(false));
  }, [slug, navigate]);

  // Increment view once
  useEffect(() => {
    if (!article?._id || viewTracked.current) return;
    viewTracked.current = true;
    void clientApi
      .patch<{ views: number }>(`/news/public/${article._id}/view`)
      .then((res) => setArticle((prev) => prev ? { ...prev, views: res.views } : prev))
      .catch(() => {});
  }, [article?._id]);

  // Load comments when article is available
  useEffect(() => {
    if (!article?._id) return;
    setCommentsLoading(true);
    void clientApi
      .get<NewsComment[]>(`/news/public/${article._id}/comments`)
      .then((data) => setComments(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setCommentsLoading(false));
  }, [article?._id]);

  const handleLike = async () => {
    if (!article) return;
    try {
      if (!liked) {
        const res = await clientApi.post<{ likeCount: number }>(`/news/public/${article._id}/like`);
        setLikeCount(res.likeCount);
        setLiked(true);
        setLikedNews([...getLikedNews(), article._id]);
      } else {
        const res = await clientApi.delete<{ likeCount: number }>(`/news/public/${article._id}/like`);
        setLikeCount(res.likeCount);
        setLiked(false);
        setLikedNews(getLikedNews().filter((id) => id !== article._id));
      }
    } catch {}
  };

  const handleCommentVote = async (commentId: string, voteType: 'like' | 'dislike') => {
    const current = commentVotes[commentId] ?? null;
    if (current === voteType) {
      try {
        const res = await clientApi.delete<{ likeCount: number; dislikeCount: number }>(
          `/news/public/comments/${commentId}/${voteType}`,
        );
        setCommentVotes((v) => ({ ...v, [commentId]: null }));
        setCommentCounts((c) => ({ ...c, [commentId]: res }));
      } catch {}
    } else {
      if (current) await clientApi.delete(`/news/public/comments/${commentId}/${current}`).catch(() => {});
      try {
        const res = await clientApi.post<{ likeCount: number; dislikeCount: number }>(
          `/news/public/comments/${commentId}/${voteType}`,
        );
        setCommentVotes((v) => ({ ...v, [commentId]: voteType }));
        setCommentCounts((c) => ({ ...c, [commentId]: res }));
      } catch {}
    }
  };

  const handleSubmitComment = async (e: FormEvent) => {
    e.preventDefault();
    if (!article || !commentInput.trim()) return;
    setSubmittingComment(true);
    try {
      const newComment = await clientApi.post<NewsComment>(
        `/news/public/${article._id}/comments`,
        { content: commentInput.trim() },
      );
      setComments((prev) => [newComment, ...prev]);
      setCommentInput('');
    } catch {}
    setSubmittingComment(false);
  };

  const handleCopyLink = () => {
    void navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading) {
    return (
      <div className="client-surface flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#006241] border-t-transparent" />
      </div>
    );
  }

  if (!article) return null;

  const authorName = article.author?.username ?? 'Ban biên tập';

  return (
    <div className="client-surface min-h-[80vh]">
      {/* Hero image */}
      {article.titleImageUrl && (
        <div className="relative h-72 overflow-hidden md:h-[420px]" style={{ background: '#1E3932' }}>
          <img src={article.titleImageUrl} alt={article.title} className="h-full w-full object-cover opacity-70" />
          <div className="absolute inset-0 bg-black/40" />
        </div>
      )}

      <div className="mx-auto max-w-7xl px-4 py-10 lg:px-8">
        <Link to="/client/news" className="mb-6 flex items-center gap-2 text-sm font-semibold text-[#006241] hover:underline">
          <ArrowLeft size={15} /> Quay lại tin tức
        </Link>

        <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
          {/* Main article */}
          <div className="space-y-6">
            <article className="client-card p-8 md:p-10">
              <div className="mb-5 flex flex-wrap items-center gap-3 text-xs text-gray-400">
                <span className="flex items-center gap-1.5">
                  <Calendar size={13} />
                  {new Date(article.createdAt).toLocaleDateString('vi-VN', {
                    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
                  })}
                </span>
                <span>·</span>
                <span>{authorName}</span>
              </div>

              <h1 className="text-3xl font-black leading-tight text-[#1E3932] md:text-4xl">{article.title}</h1>
              {article.subTitle && (
                <p className="mt-4 text-base leading-relaxed text-gray-500">{article.subTitle}</p>
              )}

              <div className="mt-5 flex items-center gap-5 text-sm text-gray-400">
                <span className="flex items-center gap-1.5">👁 {article.views ?? 0} lượt đọc</span>
                <span className="flex items-center gap-1.5">❤️ {likeCount} lượt thích</span>
                <span className="flex items-center gap-1.5">
                  <MessageCircle size={14} /> {comments.length} bình luận
                </span>
              </div>

              <div className="my-7 h-px bg-black/5" />

              {article.content ? (
                <div
                  className="prose prose-green max-w-none text-sm leading-relaxed text-gray-700 md:text-base"
                  style={{ '--tw-prose-headings': '#1E3932', '--tw-prose-links': '#006241' } as CSSProperties}
                  dangerouslySetInnerHTML={{ __html: article.content }}
                />
              ) : (
                <p className="italic text-gray-400">Nội dung đang được cập nhật...</p>
              )}

              {/* Action bar */}
              <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-black/5 pt-6">
                <button
                  onClick={() => { void handleLike(); }}
                  className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    liked ? 'border-red-400 bg-red-50 text-red-500' : 'border-black/10 text-gray-500 hover:border-red-300 hover:text-red-400'
                  }`}
                >
                  <span className="text-base leading-none">{liked ? '❤️' : '🤍'}</span>
                  <span>{liked ? `Đã thích (${likeCount})` : 'Thích'}</span>
                </button>

                <button
                  onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`, '_blank')}
                  className="flex items-center gap-2 rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-gray-500 transition hover:border-blue-400 hover:text-blue-600"
                >
                  <Facebook size={14} /> Facebook
                </button>

                <button
                  onClick={() => window.open(`https://zalo.me/share/url?url=${encodeURIComponent(window.location.href)}`, '_blank')}
                  className="flex items-center gap-2 rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-gray-500 transition hover:border-blue-300 hover:text-blue-500"
                >
                  <Share2 size={14} /> Zalo
                </button>

                <button
                  onClick={handleCopyLink}
                  className="flex items-center gap-2 rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-gray-500 transition hover:border-[#006241] hover:text-[#006241]"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Đã sao chép!' : 'Sao chép link'}
                </button>
              </div>
            </article>

            {/* Comments section */}
            <section className="client-card p-8 md:p-10">
              <h2 className="mb-6 flex items-center gap-2 text-lg font-black text-[#1E3932]">
                <MessageCircle size={20} /> Bình luận ({comments.length})
              </h2>

              {/* Comment form */}
              {session ? (
                <form onSubmit={(e) => { void handleSubmitComment(e); }} className="mb-7">
                  <div className="flex gap-3">
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-black text-white"
                      style={{ background: '#1E3932' }}
                    >
                      {session.user.username?.[0]?.toUpperCase() ?? 'U'}
                    </div>
                    <div className="flex-1 space-y-2">
                      <textarea
                        value={commentInput}
                        onChange={(e) => setCommentInput(e.target.value)}
                        placeholder="Viết bình luận của bạn..."
                        rows={3}
                        className="client-input w-full resize-none px-4 py-3 text-sm"
                      />
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={!commentInput.trim() || submittingComment}
                          className="client-pill-primary inline-flex items-center gap-2 px-5 py-2 text-sm font-bold disabled:opacity-50"
                        >
                          {submittingComment ? <LoaderCircle size={14} className="animate-spin" /> : <Send size={14} />}
                          Gửi
                        </button>
                      </div>
                    </div>
                  </div>
                </form>
              ) : (
                <div className="mb-6 rounded-2xl border border-[#006241]/15 bg-[#006241]/5 px-5 py-4 text-sm text-[#006241]">
                  <Link to="/client/login" className="font-bold hover:underline">Đăng nhập</Link> để bình luận.
                </div>
              )}

              {/* Comment list */}
              {commentsLoading ? (
                <div className="flex justify-center py-8">
                  <LoaderCircle size={20} className="animate-spin text-[#006241]/40" />
                </div>
              ) : comments.length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-400">Chưa có bình luận nào. Hãy là người đầu tiên!</p>
              ) : (
                <div className="space-y-5">
                  {comments.map((c) => {
                    const counts = commentCounts[c.id] ?? { likeCount: c.likeCount, dislikeCount: c.dislikeCount };
                    const vote = commentVotes[c.id] ?? null;
                    return (
                      <div key={c.id} className="flex gap-3">
                        <div
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-black text-white"
                          style={{ background: '#1E3932' }}
                        >
                          {c.author.username[0]?.toUpperCase() ?? 'U'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2">
                            <p className="text-sm font-bold text-[#1E3932]">{c.author.username}</p>
                            <p className="text-[11px] text-gray-400">
                              {new Date(c.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </p>
                          </div>
                          <p className="mt-1 text-sm leading-relaxed text-gray-700">{c.content}</p>
                          <div className="mt-2 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => { void handleCommentVote(c.id, 'like'); }}
                              className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                                vote === 'like' ? 'border-[#006241] bg-[#006241]/10 text-[#006241]' : 'border-black/10 text-gray-400 hover:text-[#006241]'
                              }`}
                            >
                              <ThumbsUp size={11} />
                              {counts.likeCount > 0 ? counts.likeCount : ''}
                            </button>
                            <button
                              type="button"
                              onClick={() => { void handleCommentVote(c.id, 'dislike'); }}
                              className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                                vote === 'dislike' ? 'border-red-400 bg-red-50 text-red-500' : 'border-black/10 text-gray-400 hover:text-red-400'
                              }`}
                            >
                              <ThumbsDown size={11} />
                              {counts.dislikeCount > 0 ? counts.dislikeCount : ''}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          {/* Sidebar */}
          <aside className="space-y-4">
            {related.length > 0 && (
              <div className="client-card p-5">
                <h3 className="mb-4 text-sm font-black uppercase tracking-wider text-gray-400">Bài viết liên quan</h3>
                <div className="space-y-4">
                  {related.map((r) => (
                    <Link key={r._id} to={`/client/news/${r.slug}`} className="group flex items-start gap-3">
                      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-[#d4e9e2]">
                        {r.titleImageUrl ? (
                          <img src={r.titleImageUrl} alt={r.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xl">🌿</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="line-clamp-2 text-sm font-semibold leading-snug text-[#1E3932] group-hover:text-[#006241]">{r.title}</p>
                        <p className="mt-1 text-[11px] text-gray-400">{new Date(r.createdAt).toLocaleDateString('vi-VN')}</p>
                      </div>
                    </Link>
                  ))}
                </div>
                <Link to="/client/news" className="mt-4 flex items-center gap-1 text-xs font-bold text-[#006241] hover:underline">
                  Xem tất cả tin tức <ArrowRight size={12} />
                </Link>
              </div>
            )}

            <div className="client-feature-band p-5 text-center">
              <span className="text-3xl">📬</span>
              <h3 className="mt-3 font-black text-white">Nhận tin mới nhất</h3>
              <p className="mt-1 text-xs text-white/60">Cập nhật kiến thức nông nghiệp mỗi tuần.</p>
              <input
                type="email"
                placeholder="Email của bạn..."
                className="mt-3 w-full rounded-full bg-white/10 px-4 py-2.5 text-sm text-white placeholder-white/40 outline-none focus:bg-white/20"
              />
              <button className="client-pill-primary mt-2 w-full py-2.5 text-sm font-bold">
                Đăng ký
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
