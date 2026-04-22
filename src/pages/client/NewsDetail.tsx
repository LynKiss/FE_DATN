import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Share2, ArrowRight, Copy, Check, Facebook } from 'lucide-react';
import { clientApi } from '../../lib/client-api';

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
  author?: { username: string; fullName?: string };
};

type RelatedNews = {
  _id: string;
  title: string;
  slug: string;
  titleImageUrl?: string;
  createdAt: string;
};

const LIKED_NEWS_KEY = 'liked_news';

function getLikedNews(): string[] {
  try {
    return JSON.parse(localStorage.getItem(LIKED_NEWS_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

function setLikedNews(ids: string[]) {
  localStorage.setItem(LIKED_NEWS_KEY, JSON.stringify(ids));
}

export default function NewsDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [article, setArticle] = useState<NewsDetail | null>(null);
  const [related, setRelated] = useState<RelatedNews[]>([]);
  const [loading, setLoading] = useState(true);

  // Like state
  const [likeCount, setLikeCount] = useState(0);
  const [liked, setLiked] = useState(false);

  // View count — call once only (guard against StrictMode double-invoke)
  const viewTracked = useRef(false);

  // Copy link state
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    viewTracked.current = false;

    void clientApi
      .get<NewsDetail>(`/news/public/by-slug/${slug}`)
      .then(async (item) => {
        setArticle(item);
        setLikeCount(item.likeCount ?? 0);

        const likedIds = getLikedNews();
        setLiked(likedIds.includes(item._id));

        // Fetch related
        const rel = await clientApi
          .get<{ items?: RelatedNews[]; meta?: unknown } | RelatedNews[]>('/news/public/list?limit=4')
          .catch(() => [] as RelatedNews[]);
        const relItems = Array.isArray(rel) ? rel : ((rel as { items?: RelatedNews[] }).items ?? []);
        setRelated(relItems.filter((r) => r._id !== item._id).slice(0, 3));
      })
      .catch(() => { void navigate('/client/news'); })
      .finally(() => setLoading(false));
  }, [slug, navigate]);

  // Increment view once after article is loaded
  useEffect(() => {
    if (!article || viewTracked.current) return;
    viewTracked.current = true;
    void clientApi
      .patch<{ views: number }>(`/news/public/${article._id}/view`)
      .then((res) => {
        setArticle((prev) => prev ? { ...prev, views: res.views } : prev);
      })
      .catch(() => {});
  }, [article?._id]);

  const handleLike = async () => {
    if (!article) return;
    if (!liked) {
      try {
        const res = await clientApi.post<{ likeCount: number }>(`/news/public/${article._id}/like`);
        setLikeCount(res.likeCount);
        setLiked(true);
        const ids = getLikedNews();
        setLikedNews([...ids, article._id]);
      } catch {
        // silently ignore
      }
    } else {
      try {
        const res = await clientApi.delete<{ likeCount: number }>(`/news/public/${article._id}/like`);
        setLikeCount(res.likeCount);
        setLiked(false);
        const ids = getLikedNews().filter((id) => id !== article._id);
        setLikedNews(ids);
      } catch {
        // silently ignore
      }
    }
  };

  const handleCopyLink = () => {
    void navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleShareFacebook = () => {
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`,
      '_blank',
    );
  };

  const handleShareZalo = () => {
    window.open(
      `https://zalo.me/share/url?url=${encodeURIComponent(window.location.href)}`,
      '_blank',
    );
  };

  if (loading) {
    return (
      <div style={{ background: '#f2f0eb', minHeight: '60vh' }} className="flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#006241] border-t-transparent" />
      </div>
    );
  }

  if (!article) return null;

  const authorName = article.author?.fullName ?? article.author?.username ?? 'Ban biên tập';

  return (
    <div style={{ background: '#f2f0eb', minHeight: '80vh' }}>
      {/* Hero image */}
      {article.titleImageUrl && (
        <div className="relative h-64 overflow-hidden md:h-96" style={{ background: '#1E3932' }}>
          <img
            src={article.titleImageUrl}
            alt={article.title}
            className="h-full w-full object-cover opacity-70"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent" />
        </div>
      )}

      <div className="mx-auto max-w-4xl px-4 py-10 lg:px-6">
        {/* Back */}
        <Link
          to="/client/news"
          className="mb-6 flex items-center gap-2 text-sm font-semibold text-[#006241] hover:underline"
        >
          <ArrowLeft size={15} /> Quay lại tin tức
        </Link>

        <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
          {/* Main article */}
          <article className="rounded-2xl bg-white p-8 shadow-sm">
            <div className="mb-4 flex items-center gap-3 text-xs text-gray-400">
              <Calendar size={13} />
              {new Date(article.createdAt).toLocaleDateString('vi-VN', {
                weekday: 'long',
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
              <span>·</span>
              <span>{authorName}</span>
            </div>

            <h1 className="text-3xl font-black leading-tight text-[#1E3932]">{article.title}</h1>
            {article.subTitle && (
              <p className="mt-3 text-base leading-relaxed text-gray-500">{article.subTitle}</p>
            )}

            {/* Stats bar */}
            <div className="mt-4 flex items-center gap-4 text-sm text-gray-400">
              <span className="flex items-center gap-1">
                👁 <span>{article.views ?? 0} lượt đọc</span>
              </span>
              <span className="flex items-center gap-1">
                ❤️ <span>{likeCount} lượt thích</span>
              </span>
            </div>

            <div className="my-6 h-px bg-black/5" />

            {article.content ? (
              <div
                className="prose prose-green max-w-none text-sm leading-relaxed text-gray-700"
                style={{
                  '--tw-prose-headings': '#1E3932',
                  '--tw-prose-links': '#006241',
                } as CSSProperties}
                dangerouslySetInnerHTML={{ __html: article.content }}
              />
            ) : (
              <p className="italic text-gray-400">Nội dung đang được cập nhật...</p>
            )}

            {/* Action bar: Like + Share */}
            <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-black/5 pt-6">
              {/* Like button */}
              <button
                onClick={() => { void handleLike(); }}
                className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  liked
                    ? 'border-red-400 bg-red-50 text-red-500'
                    : 'border-black/10 text-gray-500 hover:border-red-300 hover:text-red-400'
                }`}
              >
                <span className="text-base leading-none">{liked ? '❤️' : '🤍'}</span>
                <span>{liked ? 'Đã thích' : 'Thích'}</span>
              </button>

              {/* Facebook share */}
              <button
                onClick={handleShareFacebook}
                className="flex items-center gap-2 rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-gray-500 transition hover:border-blue-400 hover:text-blue-600"
              >
                <Facebook size={14} />
                <span>Facebook</span>
              </button>

              {/* Zalo share */}
              <button
                onClick={handleShareZalo}
                className="flex items-center gap-2 rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-gray-500 transition hover:border-blue-300 hover:text-blue-500"
              >
                <Share2 size={14} />
                <span>Zalo</span>
              </button>

              {/* Copy link */}
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-2 rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-gray-500 transition hover:border-[#006241] hover:text-[#006241]"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                <span>{copied ? 'Đã sao chép!' : 'Sao chép link'}</span>
              </button>
            </div>
          </article>

          {/* Sidebar */}
          <aside>
            {related.length > 0 && (
              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <h3 className="mb-4 text-sm font-black uppercase tracking-wider text-gray-400">
                  Bài viết liên quan
                </h3>
                <div className="space-y-4">
                  {related.map((r) => (
                    <Link
                      key={r._id}
                      to={`/client/news/${r.slug}`}
                      className="group flex items-start gap-3"
                    >
                      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-[#d4e9e2]">
                        {r.titleImageUrl ? (
                          <img
                            src={r.titleImageUrl}
                            alt={r.title}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xl">🌿</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="line-clamp-2 text-sm font-semibold leading-snug text-[#1E3932] group-hover:text-[#006241]">
                          {r.title}
                        </p>
                        <p className="mt-1 text-[11px] text-gray-400">
                          {new Date(r.createdAt).toLocaleDateString('vi-VN')}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
                <Link
                  to="/client/news"
                  className="mt-4 flex items-center gap-1 text-xs font-bold text-[#006241] hover:underline"
                >
                  Xem tất cả tin tức <ArrowRight size={12} />
                </Link>
              </div>
            )}

            {/* Newsletter */}
            <div
              className="mt-4 rounded-2xl p-5 text-center"
              style={{ background: '#1E3932' }}
            >
              <span className="text-3xl">📬</span>
              <h3 className="mt-3 font-black text-white">Nhận tin mới nhất</h3>
              <p className="mt-1 text-xs text-white/60">Cập nhật kiến thức nông nghiệp mỗi tuần.</p>
              <input
                type="email"
                placeholder="Email của bạn..."
                className="mt-3 w-full rounded-full bg-white/10 px-4 py-2.5 text-sm text-white placeholder-white/40 outline-none focus:bg-white/20"
              />
              <button
                className="mt-2 w-full rounded-full py-2.5 text-sm font-bold text-white"
                style={{ background: '#00754A' }}
              >
                Đăng ký
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
