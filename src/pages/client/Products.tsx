import { useEffect, useState, useCallback, useRef, useMemo, type FormEvent, type MouseEvent, type ReactNode } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Search,
  SlidersHorizontal,
  Leaf,
  X,
  ChevronLeft,
  ChevronRight,
  Filter,
  Heart,
  ShoppingCart,
  Star,
  LayoutGrid,
  List,
  Tag as TagIcon,
  Globe,
  Flame,
  Eye,
  Sparkles,
  Award,
  Check,
} from 'lucide-react';
import { clientApi } from '../../lib/client-api';
import { useCart } from '../../hooks/useCart';
import { useClientSession } from '../../hooks/useClientSession';
import { triggerCartFlyAnimation } from '../../hooks/useCartAnimation';

type Product = {
  productId: string;
  productName: string;
  productSlug: string;
  basePrice: string;
  effectivePrice: string;
  primaryImageUrl: string | null;
  quantityAvailable: number;
  ratingAverage: string;
  ratingCount: number;
  unit: string | null;
  isFeatured?: boolean;
  createdAt?: string;
  category?: { categoryId: string; categoryName: string };
  origin?: { originId?: string; originName: string };
  appliedDiscount?: { id: string; type: string; value: number; name?: string } | null;
};

type Category = { categoryId: string; categoryName: string; categorySlug: string; parentId?: string | null };
type Subcategory = { subcategoryId: string; subcategoryName: string; categoryId: string };
type Tag = { tagId: string; tagName: string };
type Origin = { originId: string; originName: string };

type RecommendationResponse = {
  items?: Product[];
};

type ProductsResponse = {
  items: Product[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

function formatPrice(price: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
}

function calcDiscountPct(base: number, effective: number): number {
  if (base <= 0 || effective >= base) return 0;
  return Math.round(((base - effective) / base) * 100);
}

const SORT_OPTIONS = [
  { value: '', label: 'Mặc định' },
  { value: 'price_asc', label: 'Giá: Thấp → Cao' },
  { value: 'price_desc', label: 'Giá: Cao → Thấp' },
  { value: 'newest', label: 'Mới nhất' },
  { value: 'rating', label: 'Đánh giá cao nhất' },
  { value: 'popular', label: 'Bán chạy' },
];

const PAGE_SIZE = 12;

const CAT_BG = [
  '#004d2e', '#0a3d24', '#163d2c', '#1a4d35', '#0d4232', '#1E3932',
];

const PRICE_RANGES = [
  { label: 'Dưới 50.000đ',           min: '',        max: '50000' },
  { label: '50.000đ – 200.000đ',     min: '50000',   max: '200000' },
  { label: '200.000đ – 500.000đ',    min: '200000',  max: '500000' },
  { label: '500.000đ – 1.000.000đ',  min: '500000',  max: '1000000' },
  { label: 'Trên 1.000.000đ',        min: '1000000', max: '' },
];

function FilterSection({
  label,
  expanded,
  onToggle,
  children,
}: {
  label: string;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between py-3"
      >
        <span className="text-[13px] font-medium text-gray-600">{label}</span>
        <ChevronRight
          size={14}
          className={`text-gray-400 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
        />
      </button>
      {expanded && <div className="pb-3">{children}</div>}
    </div>
  );
}

function isNewProduct(createdAt?: string) {
  if (!createdAt) return false;
  const days = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);
  return days <= 14;
}

function isBestSeller(p: Product) {
  return Number(p.ratingAverage ?? 0) >= 4.5 && p.ratingCount >= 10;
}

function RatingStars({ avg, count }: { avg: number; count: number }) {
  if (count === 0) return null;
  return (
    <div className="mt-1 flex items-center gap-1">
      <div className="flex">
        {[1, 2, 3, 4, 5].map((s) => (
          <Star
            key={s}
            size={10}
            fill={s <= Math.round(avg) ? '#f59e0b' : 'none'}
            className={s <= Math.round(avg) ? 'text-amber-400' : 'text-gray-200'}
          />
        ))}
      </div>
      <span className="text-[10px] text-gray-400">({count})</span>
    </div>
  );
}

export default function Products() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { session } = useClientSession();
  const { addItem } = useCart();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [origins, setOrigins] = useState<Origin[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    const saved = localStorage.getItem('products_view_mode');
    return saved === 'list' ? 'list' : 'grid';
  });
  const [quickViewId, setQuickViewId] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [wishlistedIds, setWishlistedIds] = useState<Set<string>>(new Set());
  const [togglingWishlistId, setTogglingWishlistId] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    () => new Set(['category', 'price']),
  );
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [collapsedChildSections, setCollapsedChildSections] = useState<Set<string>>(new Set());
  const [nextPage, setNextPage] = useState(1);
  const [recommendations, setRecommendations] = useState<Product[]>([]);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const page = Math.max(1, nextPage - 1);

  const search = searchParams.get('search') ?? '';
  const legacyCategoryId = searchParams.get('categoryId') ?? '';
  const selectedCategoryIds = (searchParams.get('categoryIds') ?? legacyCategoryId)
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  const categoryIdsKey = selectedCategoryIds.join(',');
  const subcategoryId = searchParams.get('subcategoryId') ?? '';
  const tagId = searchParams.get('tagId') ?? '';
  const originId = searchParams.get('originId') ?? '';
  const sort = searchParams.get('sort') ?? '';
  const priceMin = searchParams.get('priceMin') ?? '';
  const priceMax = searchParams.get('priceMax') ?? '';
  const ratingMin = searchParams.get('ratingMin') ?? '';
  const onSaleOnly = searchParams.get('onSale') === '1';
  const unit = searchParams.get('unit') ?? '';

  const [localSearch, setLocalSearch] = useState(search);
  const [localPriceMin, setLocalPriceMin] = useState(priceMin);
  const [localPriceMax, setLocalPriceMax] = useState(priceMax);

  useEffect(() => {
    void clientApi.get<Category[]>('/categories').then((d) => setCategories(Array.isArray(d) ? d : [])).catch(() => {});
    void clientApi.get<Tag[]>('/tags').then((d) => setTags(Array.isArray(d) ? d : [])).catch(() => {});
    void clientApi.get<Origin[]>('/origins').then((d) => setOrigins(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  useEffect(() => {
    localStorage.setItem('products_view_mode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (selectedCategoryIds.length === 1) {
      void clientApi
        .get<Subcategory[]>(`/subcategories?categoryId=${selectedCategoryIds[0]}`)
        .then((d) => setSubcategories(Array.isArray(d) ? d : []))
        .catch(() => setSubcategories([]));
    } else {
      setSubcategories([]);
    }
  }, [categoryIdsKey]);

  useEffect(() => {
    if (session) {
      void clientApi
        .get<Array<{ productId: string }>>('/wishlist')
        .then((items) => setWishlistedIds(new Set(items.map((i) => i.productId))))
        .catch(() => {});
    }
  }, [session]);

  const fetchProductsPage = useCallback(async (pageToLoad: number, reset = false) => {
    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    setLoadError('');
    try {
      const params = new URLSearchParams();
      params.set('page', String(pageToLoad));
      params.set('limit', String(PAGE_SIZE));
      if (search) params.set('search', search);
      if (categoryIdsKey) params.set('categoryIds', categoryIdsKey);
      if (subcategoryId) params.set('subcategoryId', subcategoryId);
      if (tagId) params.set('tagId', tagId);
      if (originId) params.set('originId', originId);
      if (priceMin) params.set('priceMin', priceMin);
      if (priceMax) params.set('priceMax', priceMax);
      if (sort === 'price_asc') { params.set('sortBy', 'product_price'); params.set('sortOrder', 'ASC'); }
      else if (sort === 'price_desc') { params.set('sortBy', 'product_price'); params.set('sortOrder', 'DESC'); }
      else if (sort === 'newest') { params.set('sortBy', 'created_at'); params.set('sortOrder', 'DESC'); }
      else if (sort === 'rating' || sort === 'popular') {
        params.set('sortBy', 'rating_average');
        params.set('sortOrder', 'DESC');
      }

      const data = await clientApi.get<ProductsResponse>(`/products?${params.toString()}`);
      let items = data.items ?? [];
      // Client-side filter: rating min + onSale (vì BE chưa support 2 filter này)
      if (ratingMin) {
        const minR = Number(ratingMin);
        items = items.filter((p) => Number(p.ratingAverage ?? 0) >= minR);
      }
      if (onSaleOnly) {
        items = items.filter(
          (p) => Number(p.effectivePrice) < Number(p.basePrice) - 0.01,
        );
      }
      if (unit) {
        items = items.filter((p) => p.unit === unit);
      }
      setProducts((current) => (reset ? items : [...current, ...items]));
      setTotal(data.meta?.total ?? 0);
      setTotalPages(data.meta?.totalPages ?? 1);
      setNextPage(pageToLoad + 1);
    } catch {
      if (reset) setProducts([]);
      setLoadError('Khong the tai them san pham');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [search, categoryIdsKey, subcategoryId, tagId, originId, priceMin, priceMax, sort, ratingMin, onSaleOnly, unit]);

  useEffect(() => {
    setNextPage(1);
    void fetchProductsPage(1, true);
  }, [fetchProductsPage]);

  useEffect(() => {
    let cancelled = false;
    clientApi
      .get<RecommendationResponse>('/intelligence/product-recommendations?limit=8&historyDays=180')
      .then((data) => {
        if (!cancelled) setRecommendations(Array.isArray(data.items) ? data.items : []);
      })
      .catch(() => {
        if (!cancelled) setRecommendations([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || loading || loadingMore || nextPage > totalPages) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void fetchProductsPage(nextPage);
        }
      },
      { rootMargin: '360px 0px' },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [fetchProductsPage, loading, loadingMore, nextPage, totalPages]);

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    next.delete('page');
    setSearchParams(next);
  };

  const updateMultiple = (pairs: Record<string, string>) => {
    const next = new URLSearchParams(searchParams);
    for (const [k, v] of Object.entries(pairs)) {
      if (v) next.set(k, v); else next.delete(k);
    }
    next.delete('page');
    setSearchParams(next);
  };

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    updateParam('search', localSearch.trim());
  };

  const handleApplyPrice = () => {
    updateMultiple({ priceMin: localPriceMin.trim(), priceMax: localPriceMax.trim() });
  };

  const handleAddToCart = async (productId: string, e: MouseEvent<HTMLButtonElement>) => {
    triggerCartFlyAnimation(e.currentTarget);
    if (!session) { void navigate('/client/login'); return; }
    setAddingId(productId);
    try { await addItem(productId, 1); } finally { setAddingId(null); }
  };

  const handleToggleWishlist = async (productId: string) => {
    if (!session) { void navigate('/client/login'); return; }
    setTogglingWishlistId(productId);
    try {
      if (wishlistedIds.has(productId)) {
        await clientApi.delete(`/wishlist/${productId}`);
        setWishlistedIds((s) => { const n = new Set(s); n.delete(productId); return n; });
      } else {
        await clientApi.post(`/wishlist/${productId}`, {});
        setWishlistedIds((s) => new Set([...s, productId]));
      }
    } catch {} finally { setTogglingWishlistId(null); }
  };

  const selectedCategoryNames = selectedCategoryIds
    .map((id) => categories.find((c) => c.categoryId === id)?.categoryName)
    .filter(Boolean) as string[];
  const selectedCategoryName =
    selectedCategoryNames.length === 1
      ? selectedCategoryNames[0]
      : selectedCategoryNames.length > 1
        ? `${selectedCategoryNames.length} danh mục`
        : undefined;
  const selectedSubcategoryName = subcategories.find((s) => s.subcategoryId === subcategoryId)?.subcategoryName;

  const selectedTagName = tags.find((t) => t.tagId === tagId)?.tagName;
  const selectedOriginName = origins.find((o) => o.originId === originId)?.originName;

  const activeFilters = [
    search && { key: 'search', label: `"${search}"`, clear: () => { setLocalSearch(''); updateParam('search', ''); } },
    selectedCategoryIds.length > 0 && { key: 'cat', label: selectedCategoryName ?? 'Danh mục', clear: () => { updateMultiple({ categoryIds: '', categoryId: '', subcategoryId: '' }); setSubcategories([]); } },
    subcategoryId && { key: 'sub', label: selectedSubcategoryName ?? 'Phân loại', clear: () => updateParam('subcategoryId', '') },
    tagId && { key: 'tag', label: `# ${selectedTagName ?? 'Tag'}`, clear: () => updateParam('tagId', '') },
    originId && { key: 'origin', label: `📍 ${selectedOriginName ?? 'Xuất xứ'}`, clear: () => updateParam('originId', '') },
    ratingMin && { key: 'rating', label: `${ratingMin}★ trở lên`, clear: () => updateParam('ratingMin', '') },
    onSaleOnly && { key: 'sale', label: '🔥 Đang giảm giá', clear: () => updateParam('onSale', '') },
    unit && { key: 'unit', label: `Đơn vị: ${unit}`, clear: () => updateParam('unit', '') },
    (priceMin || priceMax) && {
      key: 'price',
      label: priceMin && priceMax ? `${formatPrice(Number(priceMin))} – ${formatPrice(Number(priceMax))}` : priceMin ? `Từ ${formatPrice(Number(priceMin))}` : `Đến ${formatPrice(Number(priceMax))}`,
      clear: () => { setLocalPriceMin(''); setLocalPriceMax(''); updateMultiple({ priceMin: '', priceMax: '' }); },
    },
  ].filter(Boolean) as { key: string; label: string; clear: () => void }[];

  const renderPagination = () => {
    if (totalPages <= 1) return null;
    const pages: (number | '...')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push('...');
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
      if (page < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return (
      <div className="mt-8 flex items-center justify-center gap-2">
        <button disabled={page <= 1} onClick={() => updateParam('page', String(page - 1))}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white text-[#1E3932] disabled:opacity-40 hover:border-[#006241]">
          <ChevronLeft size={16} />
        </button>
        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`dots-${i}`} className="px-1 text-gray-400">…</span>
          ) : (
            <button key={p} onClick={() => updateParam('page', String(p))}
              className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition ${p === page ? 'text-white' : 'border border-black/10 bg-white text-[#1E3932] hover:border-[#006241]'}`}
              style={p === page ? { background: '#006241' } : {}}>
              {p}
            </button>
          )
        )}
        <button disabled={page >= totalPages} onClick={() => updateParam('page', String(page + 1))}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white text-[#1E3932] disabled:opacity-40 hover:border-[#006241]">
          <ChevronRight size={16} />
        </button>
      </div>
    );
  };

  const loadedCount = products.length;

  const hasActiveFilters = !!(search || tagId || originId || onSaleOnly || ratingMin || priceMin || priceMax || unit);

  const parentCats = useMemo(() => categories.filter((c) => !c.parentId), [categories]);
  const childrenOf = useCallback(
    (parentId: string) => categories.filter((c) => c.parentId === parentId),
    [categories],
  );
  const productUnits = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const p of products) {
      if (p.unit && !seen.has(p.unit)) { seen.add(p.unit); list.push(p.unit); }
    }
    return list;
  }, [products]);

  const toggleSection = (key: string) =>
    setExpandedSections((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  return (
    <div className="client-surface min-h-[80vh]">
      <div className="mx-auto max-w-7xl px-4 py-8 lg:px-6">

        {/* Product recommendations — ẩn khi filter tích cực */}
        {!hasActiveFilters && recommendations.length > 0 && (
          <section className="mb-8">
            <div className="mb-4 flex items-center gap-2">
              <Sparkles size={16} className="text-[#006241]" />
              <h2 className="text-base font-black" style={{ color: '#1E3932' }}>Gợi ý cho bạn</h2>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {recommendations.slice(0, 4).map((item) => {
                const discPct = calcDiscountPct(Number(item.basePrice), Number(item.effectivePrice));
                return (
                  <Link
                    key={item.productId}
                    to={`/client/products/${item.productId}`}
                    className="group overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm transition-shadow duration-300 hover:shadow-[0_4px_16px_rgba(0,98,65,0.12)]"
                  >
                    <div className="relative aspect-square overflow-hidden bg-[#f2f0eb]">
                      {item.primaryImageUrl ? (
                        <img
                          src={item.primaryImageUrl}
                          alt={item.productName}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <Leaf size={32} className="text-[#006241]/25" />
                        </div>
                      )}
                      {discPct > 0 && (
                        <div className="absolute left-2 top-2 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black text-white">
                          -{discPct}%
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="line-clamp-2 text-sm font-bold text-[#1E3932] transition group-hover:text-[#006241]">
                        {item.productName}
                      </p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <span className="text-sm font-black text-[#006241]">
                          {formatPrice(Number(item.effectivePrice ?? item.basePrice))}
                        </span>
                        {discPct > 0 && (
                          <span className="text-xs text-gray-400 line-through">
                            {formatPrice(Number(item.basePrice))}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* Page header */}
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em]" style={{ color: '#006241' }}>Sản phẩm</p>
            <h1 className="mt-1 text-3xl font-black" style={{ color: '#1E3932' }}>
              {selectedSubcategoryName ?? selectedCategoryName ?? (search ? `Kết quả: "${search}"` : 'Tất cả sản phẩm')}
            </h1>
            {!loading && <p className="mt-1 text-sm text-gray-500"><strong>{total}</strong> sản phẩm</p>}
          </div>

          {/* Quick filter chips */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => updateParam('onSale', onSaleOnly ? '' : '1')}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ${
                onSaleOnly
                  ? 'bg-red-500 text-white'
                  : 'bg-white border border-red-200 text-red-500 hover:bg-red-50'
              }`}
            >
              <Flame size={13} />
              Đang giảm giá
            </button>
            {[5, 4].map((r) => (
              <button
                key={r}
                onClick={() =>
                  updateParam('ratingMin', ratingMin === String(r) ? '' : String(r))
                }
                className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold transition ${
                  ratingMin === String(r)
                    ? 'bg-[#fbbc05] text-[#1E3932]'
                    : 'bg-white border border-amber-200 text-amber-600 hover:bg-amber-50'
                }`}
              >
                <Star size={12} fill="currentColor" />
                {r}★ trở lên
              </button>
            ))}
          </div>
        </div>

        {/* Mobile search bar */}
        <form onSubmit={handleSearch} className="mb-4 flex gap-2 lg:hidden">
          <div className="relative flex-1">
            <input value={localSearch} onChange={(e) => setLocalSearch(e.target.value)} placeholder="Tìm sản phẩm..."
              className="client-input w-full bg-white py-2.5 pl-4 pr-10 text-sm" />
            <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 text-[#006241]"><Search size={16} /></button>
          </div>
        </form>

        {/* Active filters */}
        {activeFilters.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {activeFilters.map((f) => (
              <button key={f.key} onClick={f.clear}
                className="flex items-center gap-1.5 rounded-full border border-[#006241]/30 bg-white px-3 py-1.5 text-xs font-semibold text-[#006241] transition hover:bg-[#006241]/8">
                <X size={11} /> {f.label}
              </button>
            ))}
            {activeFilters.length > 1 && (
              <button onClick={() => { setLocalSearch(''); setLocalPriceMin(''); setLocalPriceMax(''); setSearchParams(new URLSearchParams()); }}
                className="flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-500 transition hover:bg-red-100">
                Xóa tất cả <X size={11} />
              </button>
            )}
          </div>
        )}

        <div className="flex gap-6">
          {/* Sidebar */}
          <aside className={`${filtersOpen ? 'fixed inset-0 z-50 overflow-y-auto bg-white px-5 pt-0' : 'hidden'} w-full lg:relative lg:block lg:w-52 lg:shrink-0`}>
            {filtersOpen && (
              <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white py-4">
                <h3 className="font-bold text-[#1E3932]">Bộ lọc</h3>
                <button onClick={() => setFiltersOpen(false)}><X size={20} /></button>
              </div>
            )}

            {/* Sidebar content */}
            <div className="pt-1">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <span className="text-[15px] font-bold text-gray-900">Bộ lọc</span>
                {!loading && total > 0 && (
                  <span className="text-[13px] text-gray-400">{total} kết quả</span>
                )}
              </div>

              {/* Section: Danh mục cha */}
              <FilterSection
                label="Danh mục cha"
                expanded={expandedSections.has('category')}
                onToggle={() => toggleSection('category')}
              >
                <div className="space-y-1">
                  <button
                    onClick={() => { updateMultiple({ categoryIds: '', categoryId: '', subcategoryId: '' }); setFiltersOpen(false); }}
                    className="flex w-full items-center gap-3 py-2"
                  >
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${selectedCategoryIds.length === 0 ? 'border-[#006241] bg-[#006241]' : 'border-gray-300 bg-white'}`}>
                      {selectedCategoryIds.length === 0 && <span className="h-2 w-2 rounded-full bg-white" />}
                    </span>
                    <span className={`text-[14px] ${selectedCategoryIds.length === 0 ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>Tất cả</span>
                  </button>
                  {parentCats.map((parent) => {
                    const children = childrenOf(parent.categoryId);
                    const childIds = children.map((c) => c.categoryId);
                    const isParentSelected = selectedCategoryIds.includes(parent.categoryId);
                    const hasSelectedChild = children.some((c) => selectedCategoryIds.includes(c.categoryId));
                    const isActive = isParentSelected || hasSelectedChild;
                    return (
                      <button
                        key={parent.categoryId}
                        onClick={() => {
                          if (isActive) {
                            updateMultiple({ categoryIds: '', categoryId: '', subcategoryId: '' });
                          } else {
                            updateMultiple({ categoryIds: parent.categoryId, categoryId: '', subcategoryId: '' });
                          }
                        }}
                        className="flex w-full items-center gap-3 py-2"
                      >
                        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${isActive ? 'border-[#006241] bg-[#006241]' : 'border-gray-300 bg-white'}`}>
                          {isActive && <span className="h-2 w-2 rounded-full bg-white" />}
                        </span>
                        <span className={`text-[14px] ${isActive ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>{parent.categoryName}</span>
                        {childIds.length > 0 && <span className="ml-auto text-[11px] text-gray-400">{childIds.length}</span>}
                      </button>
                    );
                  })}
                </div>
              </FilterSection>

              {/* Section: Danh mục con — hiển thị khi parent được chọn HOẶC có child được chọn */}
              {parentCats.map((parent) => {
                const children = childrenOf(parent.categoryId);
                if (children.length === 0) return null;
                const isParentSelected = selectedCategoryIds.includes(parent.categoryId);
                const hasSelectedChild = children.some((c) => selectedCategoryIds.includes(c.categoryId));
                const noFilter = selectedCategoryIds.length === 0;
                if (!noFilter && !isParentSelected && !hasSelectedChild) return null;
                return (
                  <div key={parent.categoryId}>
                    <FilterSection
                      label={parent.categoryName}
                      expanded={!collapsedChildSections.has(parent.categoryId)}
                      onToggle={() => setCollapsedChildSections((prev: Set<string>) => {
                        const next = new Set(prev);
                        next.has(parent.categoryId) ? next.delete(parent.categoryId) : next.add(parent.categoryId);
                        return next;
                      })}
                    >
                      <div className="space-y-1">
                        {children.map((child) => {
                          const isChildSelected = selectedCategoryIds.includes(child.categoryId);
                          return (
                            <button
                              key={child.categoryId}
                              onClick={() => {
                                updateMultiple({
                                  categoryIds: isChildSelected ? parent.categoryId : child.categoryId,
                                  categoryId: '',
                                  subcategoryId: '',
                                });
                                setFiltersOpen(false);
                              }}
                              className="flex w-full items-center gap-3 py-2"
                            >
                              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${isChildSelected ? 'border-[#006241] bg-[#006241]' : 'border-gray-300 bg-white'}`}>
                                {isChildSelected && <span className="h-2 w-2 rounded-full bg-white" />}
                              </span>
                              <span className={`text-[14px] ${isChildSelected ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>{child.categoryName}</span>
                            </button>
                          );
                        })}
                      </div>
                    </FilterSection>
                  </div>
                );
              })}


              {/* Section: Đơn vị */}
              {productUnits.length > 0 && (
                <FilterSection
                  label="Đơn vị"
                  expanded={expandedSections.has('unit')}
                  onToggle={() => toggleSection('unit')}
                >
                  <div className="space-y-0.5">
                    {productUnits.map((u) => (
                      <button
                        key={u}
                        onClick={() => { updateParam('unit', unit === u ? '' : u); setFiltersOpen(false); }}
                        className="flex w-full items-center gap-3 py-1.5"
                      >
                        <span className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border transition ${unit === u ? 'border-[#006241] bg-[#006241]' : 'border-gray-300 bg-white'}`}>
                          {unit === u && <span className="h-[7px] w-[7px] rounded-full bg-white" />}
                        </span>
                        <span className="text-[14px] text-gray-800">{u}</span>
                      </button>
                    ))}
                  </div>
                </FilterSection>
              )}

              {/* Section: Khoảng giá */}
              <FilterSection
                label="Khoảng giá"
                expanded={expandedSections.has('price')}
                onToggle={() => toggleSection('price')}
              >
                <div className="space-y-0.5">
                  {PRICE_RANGES.map((range) => {
                    const isSelected = priceMin === range.min && priceMax === range.max;
                    return (
                      <button
                        key={range.label}
                        onClick={() => {
                          if (isSelected) {
                            setLocalPriceMin(''); setLocalPriceMax('');
                            updateMultiple({ priceMin: '', priceMax: '' });
                          } else {
                            setLocalPriceMin(range.min); setLocalPriceMax(range.max);
                            updateMultiple({ priceMin: range.min, priceMax: range.max });
                          }
                          setFiltersOpen(false);
                        }}
                        className="flex w-full items-center gap-3 py-1.5"
                      >
                        <span className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border transition ${isSelected ? 'border-[#006241] bg-[#006241]' : 'border-gray-300 bg-white'}`}>
                          {isSelected && <span className="h-[7px] w-[7px] rounded-full bg-white" />}
                        </span>
                        <span className="text-[14px] text-gray-800">{range.label}</span>
                      </button>
                    );
                  })}
                  {/* Custom range */}
                  <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="number" placeholder="Từ" value={localPriceMin}
                        onChange={(e) => setLocalPriceMin(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-[13px] outline-none transition focus:border-[#006241]/50"
                      />
                      <span className="shrink-0 text-gray-300">–</span>
                      <input
                        type="number" placeholder="Đến" value={localPriceMax}
                        onChange={(e) => setLocalPriceMax(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-[13px] outline-none transition focus:border-[#006241]/50"
                      />
                    </div>
                    <button
                      onClick={() => { handleApplyPrice(); setFiltersOpen(false); }}
                      className="w-full rounded-lg border border-gray-800 py-2 text-[13px] font-semibold text-gray-800 transition hover:bg-gray-800 hover:text-white"
                    >
                      Áp dụng
                    </button>
                  </div>
                </div>
              </FilterSection>

              {/* Section: Xuất xứ */}
              {origins.length > 0 && (
                <FilterSection
                  label="Xuất xứ"
                  expanded={expandedSections.has('origin')}
                  onToggle={() => toggleSection('origin')}
                >
                  <div className="max-h-48 space-y-0.5 overflow-y-auto">
                    {origins.map((o) => {
                      const isSel = originId === o.originId;
                      return (
                        <button
                          key={o.originId}
                          onClick={() => { updateParam('originId', isSel ? '' : o.originId); setFiltersOpen(false); }}
                          className="flex w-full items-center gap-3 py-1.5"
                        >
                          <span className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border transition ${isSel ? 'border-[#006241] bg-[#006241]' : 'border-gray-300 bg-white'}`}>
                            {isSel && <span className="h-[7px] w-[7px] rounded-full bg-white" />}
                          </span>
                          <span className="text-[14px] text-gray-800">{o.originName}</span>
                        </button>
                      );
                    })}
                  </div>
                </FilterSection>
              )}

              {/* Section: Nhãn */}
              {tags.length > 0 && (
                <FilterSection
                  label="Nhãn"
                  expanded={expandedSections.has('tag')}
                  onToggle={() => toggleSection('tag')}
                >
                  <div className="space-y-0.5">
                    {tags.map((t) => (
                      <button
                        key={t.tagId}
                        onClick={() => { updateParam('tagId', tagId === t.tagId ? '' : t.tagId); setFiltersOpen(false); }}
                        className="flex w-full items-center gap-3 py-1.5"
                      >
                        <span className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border transition ${tagId === t.tagId ? 'border-[#006241] bg-[#006241]' : 'border-gray-300 bg-white'}`}>
                          {tagId === t.tagId && <span className="h-[7px] w-[7px] rounded-full bg-white" />}
                        </span>
                        <span className="text-[14px] text-gray-800">#{t.tagName}</span>
                      </button>
                    ))}
                  </div>
                </FilterSection>
              )}
            </div>
          </aside>

          {/* Main content */}
          <div className="min-w-0 flex-1">
            {/* Toolbar */}
            <div className="mb-5 flex items-center justify-between gap-3">
              <button onClick={() => setFiltersOpen(true)}
                className="flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm font-semibold text-[#1E3932] transition hover:border-[#006241] lg:hidden">
                <Filter size={15} /> Bộ lọc {activeFilters.length > 0 && <span className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black text-white" style={{ background: '#006241' }}>{activeFilters.length}</span>}
              </button>
              <div className="ml-auto flex items-center gap-2">
                {/* View mode toggle */}
                <div className="hidden rounded-full border border-black/10 bg-white p-1 sm:flex">
                  <button
                    onClick={() => setViewMode('grid')}
                    title="Lưới"
                    className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
                      viewMode === 'grid'
                        ? 'bg-[#006241] text-white'
                        : 'text-gray-400 hover:text-[#006241]'
                    }`}
                  >
                    <LayoutGrid size={14} />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    title="Danh sách"
                    className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
                      viewMode === 'list'
                        ? 'bg-[#006241] text-white'
                        : 'text-gray-400 hover:text-[#006241]'
                    }`}
                  >
                    <List size={14} />
                  </button>
                </div>
                <SlidersHorizontal size={15} className="hidden text-gray-400 sm:block" />
                <select value={sort} onChange={(e) => updateParam('sort', e.target.value)}
                  className="rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm font-semibold text-[#1E3932] outline-none transition hover:border-[#006241]">
                  {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>

            {/* Info bar */}
            {!loading && total > 0 && (
              <p className="mb-3 text-xs text-gray-400">
                Hiển thị <span className="font-semibold text-gray-600">{loadedCount}</span> / <span className="font-semibold text-gray-600">{total}</span> sản phẩm
              </p>
            )}


            {/* Product grid area */}
            <div>
            {loading ? (
              <div className={
                viewMode === 'list'
                  ? 'flex flex-col gap-3'
                  : 'grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4'
              }>
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="client-card-soft overflow-hidden">
                    <div className="h-44 animate-pulse bg-gray-100" />
                    <div className="space-y-2 p-4">
                      <div className="h-3 w-1/3 animate-pulse rounded-full bg-gray-100" />
                      <div className="h-4 w-3/4 animate-pulse rounded-full bg-gray-100" />
                      <div className="h-4 w-1/2 animate-pulse rounded-full bg-gray-100" />
                      <div className="h-8 animate-pulse rounded-xl bg-gray-100" />
                    </div>
                  </div>
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="client-card flex flex-col items-center justify-center py-24 text-center">
                <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full" style={{ background: '#d4e9e2' }}>
                  <Leaf size={36} style={{ color: '#006241' }} />
                </div>
                <h3 className="text-lg font-black text-[#1E3932]">Không tìm thấy sản phẩm</h3>
                <p className="mt-2 max-w-xs text-sm text-gray-400">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm để xem thêm sản phẩm.</p>
                <button onClick={() => { setLocalSearch(''); setLocalPriceMin(''); setLocalPriceMax(''); setSearchParams(new URLSearchParams()); }}
                  className="client-pill-primary mt-6 px-6 py-2.5 text-sm font-bold">
                  Xóa bộ lọc
                </button>
              </div>
            ) : (
              <div className={
                viewMode === 'list'
                  ? 'flex flex-col gap-3'
                  : 'grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4'
              }>
                {products.map((product) => {
                  const base = Number(product.basePrice);
                  const effective = Number(product.effectivePrice);
                  const hasDiscount = effective < base - 0.01;
                  const discountPct = calcDiscountPct(base, effective);
                  const isWishlisted = wishlistedIds.has(product.productId);
                  const outOfStock = product.quantityAvailable === 0;
                  const rating = Number(product.ratingAverage ?? 0);
                  const lowStock = !outOfStock && product.quantityAvailable <= 10;

                  const isList = viewMode === 'list';

                  return (
                    <div
                      key={product.productId}
                      className={`client-card-soft group overflow-hidden transition-all duration-300 hover:border-[#006241]/30 ${
                        isList
                          ? 'flex flex-row'
                          : 'flex flex-col'
                      }`}
                    >
                      {/* Image area */}
                      <div
                        className={`relative shrink-0 overflow-hidden bg-gray-50 ${
                          isList ? 'w-32 self-stretch sm:w-40 md:w-48' : 'w-full'
                        }`}
                        style={!isList ? { aspectRatio: '1/1' } : undefined}
                      >
                        <Link
                          to={`/client/products/${product.productId}`}
                          className="absolute inset-0 block"
                        >
                          {/* Always render placeholder underneath; image hides itself on error */}
                          <div
                            className="absolute inset-0 flex items-center justify-center"
                            style={{ background: '#f2f0eb' }}
                            aria-hidden="true"
                          >
                            <Leaf size={32} className="opacity-20" style={{ color: '#006241' }} />
                          </div>
                          {product.primaryImageUrl && (
                            <img
                              src={product.primaryImageUrl}
                              alt={product.productName}
                              className="relative h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          )}
                        </Link>

                        {/* Badges (top-left stack) */}
                        <div className={`absolute left-2 top-2 flex flex-col gap-1 ${isList ? '' : 'sm:left-3 sm:top-3 sm:gap-1.5'}`}>
                          {hasDiscount && discountPct > 0 && (
                            <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black text-white sm:px-2.5 sm:py-1 sm:text-[11px]">
                              -{discountPct}%
                            </span>
                          )}
                          {!isList && isNewProduct(product.createdAt) && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-[#d4e9e2] px-2 py-0.5 text-[10px] font-black text-[#006241]">
                              <Sparkles size={9} /> Mới
                            </span>
                          )}
                          {!isList && isBestSeller(product) && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-[#edebe9] px-2 py-0.5 text-[10px] font-black text-[#1E3932]">
                              <Award size={9} /> Bán chạy
                            </span>
                          )}
                        </div>

                        {/* Wishlist always visible */}
                        {!isList && (
                          <button
                            onClick={() => void handleToggleWishlist(product.productId)}
                            disabled={togglingWishlistId === product.productId}
                            title={isWishlisted ? 'Bỏ yêu thích' : 'Yêu thích'}
                            className={`absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full transition-all ${
                              isWishlisted
                                ? 'bg-red-50 text-red-500'
                                : 'bg-white/95 text-gray-400 hover:text-red-400'
                            }`}
                          >
                            <Heart size={14} fill={isWishlisted ? 'currentColor' : 'none'} />
                          </button>
                        )}

                        {/* Out of stock overlay */}
                        {outOfStock && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
                            <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black text-gray-800 sm:px-4 sm:py-1.5 sm:text-xs">
                              Hết hàng
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className={`flex flex-1 flex-col ${isList ? 'p-3 sm:p-4' : 'p-3'}`}>
                        <div className="flex-1">
                          {product.category && (
                            <p className="mb-0.5 text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: '#006241' }}>
                              {product.category.categoryName}
                            </p>
                          )}

                          <Link
                            to={`/client/products/${product.productId}`}
                            className={`block font-bold leading-snug text-[#1E3932] transition hover:text-[#006241] line-clamp-2 ${
                              isList ? 'text-sm sm:text-base' : 'text-sm'
                            }`}
                          >
                            {product.productName}
                          </Link>

                          <div className={`mt-1 flex flex-wrap items-center gap-2 ${isList ? '' : ''}`}>
                            {rating > 0 ? (
                              <div className="flex items-center gap-1">
                                <div className="flex">
                                  {[1, 2, 3, 4, 5].map((s) => (
                                    <Star
                                      key={s}
                                      size={10}
                                      fill={s <= Math.round(rating) ? '#f59e0b' : 'none'}
                                      className={s <= Math.round(rating) ? 'text-amber-400' : 'text-gray-200'}
                                    />
                                  ))}
                                </div>
                                {product.ratingCount > 0 && (
                                  <span className="text-[10px] text-gray-400">({product.ratingCount})</span>
                                )}
                              </div>
                            ) : null}
                            {product.origin && (
                              <span className="text-[10px] text-gray-400">📍 {product.origin.originName}</span>
                            )}
                          </div>

                          {/* List-mode badges row */}
                          {isList && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {isNewProduct(product.createdAt) && (
                                <span className="inline-flex items-center gap-0.5 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-600">
                                  <Sparkles size={9} /> Mới
                                </span>
                              )}
                              {isBestSeller(product) && (
                                <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-600">
                                  <Award size={9} /> Bán chạy
                                </span>
                              )}
                              {product.isFeatured && (
                                <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-600">
                                  ⭐ Nổi bật
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Price + actions */}
                        <div className={`mt-2 ${isList ? 'border-t border-black/5 pt-2 sm:mt-3 sm:pt-3' : 'border-t border-black/5 pt-2'}`}>
                          <div className="mb-2">
                            <div className="flex flex-wrap items-baseline gap-1.5">
                              <span
                                className={`font-black ${isList ? 'text-base sm:text-lg' : 'text-base'}`}
                                style={{ color: '#006241' }}
                              >
                                {effective > 0 ? formatPrice(effective) : 'Liên hệ'}
                              </span>
                              {hasDiscount && (
                                <span className="text-xs text-gray-400 line-through">{formatPrice(base)}</span>
                              )}
                              {product.unit && (
                                <span className="text-[10px] text-gray-400">/ {product.unit}</span>
                              )}
                            </div>
                            {lowStock && (
                              <p className="mt-0.5 text-[10px] font-semibold text-orange-500">
                                Chỉ còn {product.quantityAvailable} sản phẩm
                              </p>
                            )}
                          </div>

                          <div className="flex gap-2">
                            {isList ? (
                              <button
                                onClick={() => setQuickViewId(product.productId)}
                                className="client-pill-outline flex items-center justify-center px-3 py-2 text-xs font-bold"
                                title="Xem nhanh"
                              >
                                <Eye size={14} />
                              </button>
                            ) : (
                              <Link
                                to={`/client/products/${product.productId}`}
                                className="client-pill-outline flex items-center justify-center px-3 py-2 text-xs font-bold"
                              >
                                Xem
                              </Link>
                            )}
                            <button
                              disabled={addingId === product.productId || outOfStock}
                              onClick={(e) => void handleAddToCart(product.productId, e)}
                              className="client-pill-primary flex flex-1 items-center justify-center gap-1.5 py-2 text-xs font-bold disabled:opacity-50"
                              style={{ background: outOfStock ? '#9ca3af' : '#00754A' }}
                            >
                              {addingId === product.productId ? (
                                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                              ) : (
                                <>
                                  <ShoppingCart size={12} />
                                  <span className="hidden sm:inline">Thêm vào giỏ</span>
                                  <span className="sm:hidden">Thêm</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            </div>{/* end scrollable grid area */}

            <div ref={loadMoreRef} className="mt-8 flex min-h-10 items-center justify-center">
              {loadingMore ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#1E3932]">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#006241] border-t-transparent" />
                  Đang tải thêm
                </span>
              ) : loadError ? (
                <button
                  type="button"
                  onClick={() => void fetchProductsPage(nextPage)}
                  className="client-pill-outline px-4 py-2 text-sm font-bold"
                >
                  Tải lại
                </button>
              ) : !loading && total > 0 && nextPage > totalPages ? (
                <span className="text-sm font-semibold text-gray-400">Đã tải hết sản phẩm</span>
              ) : null}
            </div>
            <div className="hidden">{renderPagination()}</div>
          </div>
        </div>
      </div>

      {/* Quick View Modal */}
      {quickViewId && (() => {
        const p = products.find((x) => x.productId === quickViewId);
        if (!p) return null;
        const base = Number(p.basePrice);
        const effective = Number(p.effectivePrice);
        const hasDiscount = effective < base - 0.01;
        const discountPct = calcDiscountPct(base, effective);
        const out = p.quantityAvailable === 0;
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setQuickViewId(null)}
          >
            <div
              className="client-card relative w-full max-w-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setQuickViewId(null)}
                className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 transition hover:bg-gray-100"
              >
                <X size={18} />
              </button>
              <div className="grid sm:grid-cols-2">
                <div className="relative h-64 sm:h-full bg-gray-50">
                  {p.primaryImageUrl ? (
                    <img src={p.primaryImageUrl} alt={p.productName} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center" style={{ background: '#f2f0eb' }}>
                      <Leaf size={48} className="opacity-20" style={{ color: '#006241' }} />
                    </div>
                  )}
                  {hasDiscount && discountPct > 0 && (
                    <span className="absolute left-3 top-3 rounded-full bg-red-500 px-3 py-1 text-xs font-black text-white">
                      -{discountPct}%
                    </span>
                  )}
                </div>
                <div className="flex flex-col p-6">
                  {p.category && (
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: '#006241' }}>
                      {p.category.categoryName}
                    </p>
                  )}
                  <h2 className="mt-2 text-xl font-black" style={{ color: '#1E3932' }}>
                    {p.productName}
                  </h2>
                  {Number(p.ratingAverage) > 0 && (
                    <div className="mt-2 flex items-center gap-1.5">
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            size={14}
                            fill={s <= Math.round(Number(p.ratingAverage)) ? '#f59e0b' : 'none'}
                            className={s <= Math.round(Number(p.ratingAverage)) ? 'text-amber-400' : 'text-gray-200'}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-gray-500">({p.ratingCount} đánh giá)</span>
                    </div>
                  )}
                  {p.origin && (
                    <p className="mt-2 text-sm text-gray-500">📍 Xuất xứ: {p.origin.originName}</p>
                  )}
                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="text-2xl font-black" style={{ color: '#006241' }}>
                      {formatPrice(effective)}
                    </span>
                    {hasDiscount && (
                      <span className="text-base text-gray-400 line-through">{formatPrice(base)}</span>
                    )}
                    {p.unit && <span className="text-xs text-gray-500">/ {p.unit}</span>}
                  </div>

                  <p className="mt-2 text-xs text-gray-500">
                    {out ? (
                      <span className="font-bold text-red-500">Hết hàng</span>
                    ) : p.quantityAvailable <= 10 ? (
                      <span className="font-semibold text-orange-500">
                        Chỉ còn {p.quantityAvailable} sản phẩm
                      </span>
                    ) : (
                      <span className="text-emerald-600">Còn hàng</span>
                    )}
                  </p>

                  <div className="mt-auto flex gap-2 pt-6">
                    <Link
                      to={`/client/products/${p.productId}`}
                      onClick={() => setQuickViewId(null)}
                      className="client-pill-outline flex flex-1 items-center justify-center px-4 py-3 text-sm font-bold"
                    >
                      Xem chi tiết
                    </Link>
                    <button
                      disabled={out || addingId === p.productId}
                      onClick={(e) => {
                        void handleAddToCart(p.productId, e);
                      }}
                      className="client-pill-primary flex flex-1 items-center justify-center gap-1.5 py-3 text-sm font-bold disabled:opacity-50"
                      style={{ background: out ? '#9ca3af' : '#00754A' }}
                    >
                      <ShoppingCart size={14} />
                      {addingId === p.productId ? 'Đang thêm...' : 'Thêm vào giỏ'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
