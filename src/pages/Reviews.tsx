import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { EyeOff, Eye, Trash2, LoaderCircle, Search, Star, RefreshCw } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { apiClient } from '../lib/api';
import { useLanguage } from '../i18n/language-context';
import { useToast } from '../hooks/useToast';
import Pagination from '../components/shared/Pagination';

type ReviewStatus = 'visible' | 'hidden' | 'deleted';

type ReviewItem = {
  commentId: string;
  content: string;
  rating: number | null;
  status: ReviewStatus;
  likeCount: number;
  dislikeCount: number;
  createdAt: string;
  user: { username: string | null };
  product: { productName: string | null };
};

type ReviewsResponse = {
  meta: { page: number; limit: number; total: number; totalPages: number };
  items: ReviewItem[];
};

type ReviewStats = {
  total: number;
  totalVisible: number;
  totalHidden: number;
  totalDeleted: number;
  averageRating: number;
  reviewsToday: number;
};

type FilterStatus = 'all' | ReviewStatus;

function StarRating({ rating }: { rating: number | null }) {
  if (rating === null) return <span className="text-xs text-on-surface-variant/50">—</span>;
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={13}
          className={s <= rating ? 'fill-amber-400 text-amber-400' : 'fill-none text-on-surface/20'}
        />
      ))}
    </span>
  );
}

function StatusBadge({ status }: { status: ReviewStatus }) {
  const cfg: Record<ReviewStatus, { label: string; cls: string }> = {
    visible: { label: 'Hiển thị', cls: 'bg-emerald-100 text-emerald-700' },
    hidden: { label: 'Ẩn', cls: 'bg-amber-100 text-amber-700' },
    deleted: { label: 'Đã xóa', cls: 'bg-red-100 text-red-700' },
  };
  const { label, cls } = cfg[status];
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${cls}`}>
      {label}
    </span>
  );
}

export default function Reviews() {
  const { language } = useLanguage();
  const isVietnamese = language === 'vi';
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 12, total: 0, totalPages: 1 });
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>(
    (searchParams.get('status') as FilterStatus) ?? 'all',
  );
  const [filterRating, setFilterRating] = useState<string>(searchParams.get('rating') ?? '');
  const [page, setPage] = useState(Number(searchParams.get('page') ?? '1'));

  const LIMIT = 12;

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(isVietnamese ? 'vi-VN' : 'en-US', {
        dateStyle: 'short',
        timeStyle: 'short',
      }),
    [isVietnamese],
  );

  // Sync URL params
  useEffect(() => {
    const next = new URLSearchParams();
    if (search.trim()) next.set('search', search.trim());
    if (filterStatus !== 'all') next.set('status', filterStatus);
    if (filterRating) next.set('rating', filterRating);
    if (page > 1) next.set('page', String(page));
    setSearchParams(next, { replace: true });
  }, [search, filterStatus, filterRating, page, setSearchParams]);

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [search, filterStatus, filterRating]);

  // Load stats
  useEffect(() => {
    let cancelled = false;
    setStatsLoading(true);
    void apiClient
      .get<ReviewStats>('/reviews/admin/stats')
      .then((data) => {
        if (!cancelled) setStats(data);
      })
      .catch(() => {
        /* stats are non-critical */
      })
      .finally(() => {
        if (!cancelled) setStatsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  // Load reviews
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const q = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (filterStatus !== 'all') q.set('status', filterStatus);
    if (filterRating) q.set('rating', filterRating);
    if (search.trim()) q.set('search', search.trim());

    void apiClient
      .get<ReviewsResponse>(`/reviews/admin?${q.toString()}`)
      .then((data) => {
        if (!cancelled) {
          setReviews(data.items);
          setMeta(data.meta);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Không tải được danh sách đánh giá',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [search, filterStatus, filterRating, page, reloadKey]);

  async function handleHide(commentId: string) {
    try {
      await apiClient.patch(`/reviews/admin/${commentId}/hide`);
      showToast({ tone: 'success', title: 'Đã ẩn đánh giá' });
      setReloadKey((k) => k + 1);
    } catch (err) {
      showToast({
        tone: 'error',
        title: 'Ẩn thất bại',
        description: err instanceof Error ? err.message : '',
      });
    }
  }

  async function handleShow(commentId: string) {
    try {
      await apiClient.patch(`/reviews/admin/${commentId}/show`);
      showToast({ tone: 'success', title: 'Đã hiển thị đánh giá' });
      setReloadKey((k) => k + 1);
    } catch (err) {
      showToast({
        tone: 'error',
        title: 'Thao tác thất bại',
        description: err instanceof Error ? err.message : '',
      });
    }
  }

  async function handleDelete(commentId: string) {
    if (!window.confirm('Xóa đánh giá này?')) return;
    try {
      await apiClient.delete(`/reviews/admin/${commentId}`);
      showToast({ tone: 'success', title: 'Đã xóa đánh giá' });
      setReloadKey((k) => k + 1);
    } catch (err) {
      showToast({
        tone: 'error',
        title: 'Xóa thất bại',
        description: err instanceof Error ? err.message : '',
      });
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-black tracking-tight text-primary">
          Quản lý đánh giá
        </h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          Kiểm duyệt đánh giá sản phẩm từ khách hàng, ẩn hoặc xóa nội dung không phù hợp.
        </p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {statsLoading || !stats ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-on-surface/8 bg-white p-4 text-center shadow-sm"
            >
              <div className="mx-auto h-7 w-12 animate-pulse rounded-lg bg-surface" />
              <div className="mx-auto mt-2 h-3 w-16 animate-pulse rounded bg-surface" />
            </div>
          ))
        ) : (
          <>
            <StatCard label="Tổng đánh giá" value={stats.total} />
            <StatCard label="Hiển thị" value={stats.totalVisible} accent="emerald" />
            <StatCard label="Đang ẩn" value={stats.totalHidden} accent="amber" />
            <StatCard label="Đã xóa" value={stats.totalDeleted} accent="red" />
            <StatCard
              label="Điểm TB"
              value={stats.averageRating.toFixed(1)}
              icon={<Star size={13} className="fill-amber-400 text-amber-400" />}
            />
            <StatCard label="Hôm nay" value={stats.reviewsToday} />
          </>
        )}
      </div>

      {/* Filter bar */}
      <section className="rounded-[2rem] border border-on-surface/8 bg-white p-5 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-[1fr_180px_160px_auto]">
          <label className="relative">
            <Search
              size={16}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm trong nội dung đánh giá..."
              className="w-full rounded-2xl border border-on-surface/10 bg-surface py-3 pl-11 pr-4 text-sm outline-none focus:border-primary/40"
            />
          </label>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
            className="rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none"
          >
            <option value="all">Tất cả</option>
            <option value="visible">Hiển thị</option>
            <option value="hidden">Ẩn</option>
            <option value="deleted">Đã xóa</option>
          </select>

          <select
            value={filterRating}
            onChange={(e) => setFilterRating(e.target.value)}
            className="rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none"
          >
            <option value="">Tất cả sao</option>
            {[5, 4, 3, 2, 1].map((r) => (
              <option key={r} value={String(r)}>
                {r} sao
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm font-semibold text-on-surface-variant transition hover:border-primary/30 hover:text-primary disabled:opacity-50"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Làm mới
          </button>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {/* Table */}
      <section className="overflow-hidden rounded-[2rem] border border-on-surface/8 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead className="border-b border-on-surface/8 bg-surface/70 text-[11px] font-black uppercase tracking-[0.18em] text-on-surface-variant/60">
              <tr>
                <th className="px-4 py-4">Sản phẩm</th>
                <th className="px-4 py-4">Người dùng</th>
                <th className="px-4 py-4">Nội dung</th>
                <th className="px-4 py-4 text-center">Rating</th>
                <th className="px-4 py-4 text-center">Lượt thích</th>
                <th className="px-4 py-4">Trạng thái</th>
                <th className="px-4 py-4">Ngày</th>
                <th className="px-4 py-4 text-center">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-on-surface/6 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center text-on-surface-variant">
                    <span className="inline-flex items-center gap-2">
                      <LoaderCircle size={16} className="animate-spin" />
                      Đang tải đánh giá...
                    </span>
                  </td>
                </tr>
              ) : reviews.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center text-on-surface-variant">
                    <Star size={28} className="mx-auto mb-3 text-primary/30" />
                    Không có đánh giá phù hợp
                  </td>
                </tr>
              ) : (
                reviews.map((review) => (
                  <tr key={review.commentId} className="hover:bg-surface/40">
                    <td className="px-4 py-4 max-w-[180px]">
                      <p className="truncate font-semibold text-on-surface">
                        {review.product.productName ?? '—'}
                      </p>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-on-surface-variant">
                      {review.user.username ?? '—'}
                    </td>
                    <td className="px-4 py-4 max-w-[260px]">
                      <p className="line-clamp-2 text-on-surface">{review.content}</p>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <StarRating rating={review.rating} />
                    </td>
                    <td className="px-4 py-4 text-center text-on-surface-variant">
                      <span className="text-emerald-600">{review.likeCount}</span>
                      {' / '}
                      <span className="text-red-500">{review.dislikeCount}</span>
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status={review.status} />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-xs text-on-surface-variant">
                      {dateFormatter.format(new Date(review.createdAt))}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-center gap-1">
                        {review.status === 'visible' ? (
                          <button
                            type="button"
                            title="Ẩn đánh giá"
                            onClick={() => void handleHide(review.commentId)}
                            className="rounded-xl p-2 text-amber-600 transition hover:bg-amber-50"
                          >
                            <EyeOff size={16} />
                          </button>
                        ) : review.status === 'hidden' ? (
                          <button
                            type="button"
                            title="Hiển thị đánh giá"
                            onClick={() => void handleShow(review.commentId)}
                            className="rounded-xl p-2 text-emerald-600 transition hover:bg-emerald-50"
                          >
                            <Eye size={16} />
                          </button>
                        ) : null}
                        {review.status !== 'deleted' && (
                          <button
                            type="button"
                            title="Xóa đánh giá"
                            onClick={() => void handleDelete(review.commentId)}
                            className="rounded-xl p-2 text-red-500 transition hover:bg-red-50"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-5 pb-5">
          <Pagination
            page={meta.page}
            limit={meta.limit}
            total={meta.total}
            totalPages={meta.totalPages}
            isVietnamese={isVietnamese}
            onPageChange={setPage}
            onLimitChange={(next) => {
              setPage(1);
              void next; // limit is fixed at 12, no-op
            }}
            pageSizeOptions={[12]}
          />
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: string | number;
  accent?: 'emerald' | 'amber' | 'red';
  icon?: ReactNode;
}) {
  const colorCls =
    accent === 'emerald'
      ? 'text-emerald-600'
      : accent === 'amber'
        ? 'text-amber-600'
        : accent === 'red'
          ? 'text-red-600'
          : 'text-primary';

  return (
    <div className="rounded-2xl border border-on-surface/8 bg-white p-4 text-center shadow-sm">
      <p className={`flex items-center justify-center gap-1 text-2xl font-black ${colorCls}`}>
        {icon}
        {value}
      </p>
      <p className="mt-1 text-xs text-on-surface-variant">{label}</p>
    </div>
  );
}
