import { useEffect, useState, useCallback, type FormEvent, type MouseEvent } from 'react';
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
  category?: { categoryId: string; categoryName: string };
  origin?: { originName: string };
  appliedDiscount?: { id: string; type: string; value: number; name?: string } | null;
};

type Category = { categoryId: string; categoryName: string; categorySlug: string };
type Subcategory = { subcategoryId: string; subcategoryName: string; categoryId: string };
type Tag = { tagId: string; tagName: string };
type Origin = { originId: string; originName: string };

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
  { value: 'price_asc', label: 'Giá tăng dần' },
  { value: 'price_desc', label: 'Giá giảm dần' },
  { value: 'newest', label: 'Mới nhất' },
  { value: 'rating', label: 'Đánh giá cao nhất' },
];

const PAGE_SIZE = 12;

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
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [wishlistedIds, setWishlistedIds] = useState<Set<string>>(new Set());
  const [togglingWishlistId, setTogglingWishlistId] = useState<string | null>(null);
  const [categoriesExpanded, setCategoriesExpanded] = useState(true);

  const search = searchParams.get('search') ?? '';
  const categoryId = searchParams.get('categoryId') ?? '';
  const subcategoryId = searchParams.get('subcategoryId') ?? '';
  const tagId = searchParams.get('tagId') ?? '';
  const originId = searchParams.get('originId') ?? '';
  const sort = searchParams.get('sort') ?? '';
  const priceMin = searchParams.get('priceMin') ?? '';
  const priceMax = searchParams.get('priceMax') ?? '';
  const page = parseInt(searchParams.get('page') ?? '1', 10);

  const [localSearch, setLocalSearch] = useState(search);
  const [localPriceMin, setLocalPriceMin] = useState(priceMin);
  const [localPriceMax, setLocalPriceMax] = useState(priceMax);

  useEffect(() => {
    void clientApi.get<Category[]>('/categories').then((d) => setCategories(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (categoryId) {
      void clientApi
        .get<Subcategory[]>(`/subcategories?categoryId=${categoryId}`)
        .then((d) => setSubcategories(Array.isArray(d) ? d : []))
        .catch(() => setSubcategories([]));
    } else {
      setSubcategories([]);
    }
  }, [categoryId]);

  useEffect(() => {
    if (session) {
      void clientApi
        .get<Array<{ productId: string }>>('/wishlist')
        .then((items) => setWishlistedIds(new Set(items.map((i) => i.productId))))
        .catch(() => {});
    }
  }, [session]);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(PAGE_SIZE));
      if (search) params.set('search', search);
      if (categoryId) params.set('categoryId', categoryId);
      if (subcategoryId) params.set('subcategoryId', subcategoryId);
      if (tagId) params.set('tagId', tagId);
      if (originId) params.set('originId', originId);
      if (priceMin) params.set('priceMin', priceMin);
      if (priceMax) params.set('priceMax', priceMax);
      if (sort === 'price_asc') { params.set('sortBy', 'product_price'); params.set('sortOrder', 'ASC'); }
      else if (sort === 'price_desc') { params.set('sortBy', 'product_price'); params.set('sortOrder', 'DESC'); }
      else if (sort === 'newest') { params.set('sortBy', 'created_at'); params.set('sortOrder', 'DESC'); }
      else if (sort === 'rating') { params.set('sortBy', 'rating_average'); params.set('sortOrder', 'DESC'); }

      const data = await clientApi.get<ProductsResponse>(`/products?${params.toString()}`);
      setProducts(data.items ?? []);
      setTotal(data.meta?.total ?? 0);
      setTotalPages(data.meta?.totalPages ?? 1);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, categoryId, subcategoryId, tagId, originId, priceMin, priceMax, sort]);

  useEffect(() => { void fetchProducts(); }, [fetchProducts]);

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

  const selectedCategoryName = categories.find((c) => c.categoryId === categoryId)?.categoryName;
  const selectedSubcategoryName = subcategories.find((s) => s.subcategoryId === subcategoryId)?.subcategoryName;

  const activeFilters = [
    search && { key: 'search', label: `"${search}"`, clear: () => { setLocalSearch(''); updateParam('search', ''); } },
    categoryId && { key: 'cat', label: selectedCategoryName ?? 'Danh mục', clear: () => { updateMultiple({ categoryId: '', subcategoryId: '' }); setSubcategories([]); } },
    subcategoryId && { key: 'sub', label: selectedSubcategoryName ?? 'Phân loại', clear: () => updateParam('subcategoryId', '') },
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

  return (
    <div style={{ background: '#f2f0eb', minHeight: '80vh' }}>
      <div className="mx-auto max-w-7xl px-4 py-8 lg:px-6">
        {/* Page header */}
        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-[0.25em]" style={{ color: '#006241' }}>Sản phẩm</p>
          <h1 className="mt-1 text-3xl font-black" style={{ color: '#1E3932' }}>
            {selectedSubcategoryName ?? selectedCategoryName ?? (search ? `Kết quả: "${search}"` : 'Tất cả sản phẩm')}
          </h1>
          {!loading && <p className="mt-1 text-sm text-gray-500"><strong>{total}</strong> sản phẩm</p>}
        </div>

        {/* Mobile search bar */}
        <form onSubmit={handleSearch} className="mb-4 flex gap-2 lg:hidden">
          <div className="relative flex-1">
            <input value={localSearch} onChange={(e) => setLocalSearch(e.target.value)} placeholder="Tìm sản phẩm..."
              className="w-full rounded-full border border-black/10 bg-white py-2.5 pl-4 pr-10 text-sm outline-none focus:border-[#006241]" />
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
          <aside className={`${filtersOpen ? 'fixed inset-0 z-50 overflow-y-auto bg-white' : 'hidden'} w-full lg:relative lg:block lg:w-56 lg:shrink-0 lg:sticky lg:top-4 lg:max-h-[calc(100vh-100px)] lg:overflow-y-auto lg:[&::-webkit-scrollbar]:hidden`}>
            {filtersOpen && (
              <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white p-5">
                <h3 className="font-bold text-[#1E3932]">Bộ lọc</h3>
                <button onClick={() => setFiltersOpen(false)}><X size={20} /></button>
              </div>
            )}

            <div className={`space-y-6 ${filtersOpen ? 'p-5' : 'rounded-2xl bg-white p-5'}`}>
              {/* Desktop search */}
              <div className="hidden lg:block">
                <form onSubmit={handleSearch} className="relative">
                  <input value={localSearch} onChange={(e) => setLocalSearch(e.target.value)} placeholder="Tìm sản phẩm..."
                    className="w-full rounded-full border border-black/10 bg-[#f2f0eb] py-2.5 pl-4 pr-10 text-sm outline-none focus:border-[#006241]" />
                  <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 text-[#006241]"><Search size={16} /></button>
                </form>
              </div>

              {/* Category */}
              <div>
                <button
                  type="button"
                  onClick={() => setCategoriesExpanded((v) => !v)}
                  className="mb-3 flex w-full items-center justify-between"
                >
                  <p className="text-[11px] font-black uppercase tracking-wider text-gray-400">Danh mục</p>
                  <ChevronRight
                    size={14}
                    className={`text-gray-400 transition-transform ${categoriesExpanded ? 'rotate-90' : ''}`}
                  />
                </button>
                {categoriesExpanded && (
                  <div className="space-y-1">
                    <button onClick={() => { updateMultiple({ categoryId: '', subcategoryId: '' }); setFiltersOpen(false); }}
                      className={`w-full rounded-xl px-3 py-2 text-left text-sm font-semibold transition ${!categoryId ? 'bg-[#006241] text-white' : 'text-[#1E3932] hover:bg-[#006241]/8'}`}>
                      Tất cả sản phẩm
                    </button>
                    {categories.map((cat) => (
                      <button key={cat.categoryId}
                        onClick={() => { updateMultiple({ categoryId: cat.categoryId, subcategoryId: '' }); setFiltersOpen(false); }}
                        className={`w-full rounded-xl px-3 py-2 text-left text-sm font-semibold transition ${categoryId === cat.categoryId ? 'bg-[#006241] text-white' : 'text-[#1E3932] hover:bg-[#006241]/8'}`}>
                        {cat.categoryName}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Subcategory */}
              {subcategories.length > 0 && (
                <div>
                  <p className="mb-3 text-[11px] font-black uppercase tracking-wider text-gray-400">Phân loại</p>
                  <div className="space-y-1">
                    <button onClick={() => updateParam('subcategoryId', '')}
                      className={`w-full rounded-xl px-3 py-2 text-left text-sm transition ${!subcategoryId ? 'font-bold text-[#006241]' : 'text-gray-500 hover:text-[#1E3932]'}`}>
                      Tất cả
                    </button>
                    {subcategories.map((sub) => (
                      <button key={sub.subcategoryId}
                        onClick={() => { updateParam('subcategoryId', sub.subcategoryId); setFiltersOpen(false); }}
                        className={`w-full rounded-xl px-3 py-2 text-left text-sm transition ${subcategoryId === sub.subcategoryId ? 'font-bold text-[#006241]' : 'text-gray-500 hover:text-[#1E3932]'}`}>
                        {sub.subcategoryName}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Price range */}
              <div>
                <p className="mb-3 text-[11px] font-black uppercase tracking-wider text-gray-400">Khoảng giá (VND)</p>
                <div className="space-y-2">
                  <input
                    type="number" placeholder="Giá tối thiểu" value={localPriceMin}
                    onChange={(e) => setLocalPriceMin(e.target.value)}
                    className="w-full rounded-xl border border-black/10 bg-[#f2f0eb] px-3 py-2 text-sm outline-none focus:border-[#006241]"
                  />
                  <input
                    type="number" placeholder="Giá tối đa" value={localPriceMax}
                    onChange={(e) => setLocalPriceMax(e.target.value)}
                    className="w-full rounded-xl border border-black/10 bg-[#f2f0eb] px-3 py-2 text-sm outline-none focus:border-[#006241]"
                  />
                  <button onClick={() => { handleApplyPrice(); setFiltersOpen(false); }}
                    className="w-full rounded-xl py-2 text-sm font-bold text-white transition active:scale-95"
                    style={{ background: '#006241' }}>
                    Áp dụng
                  </button>
                </div>
              </div>
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
                Hiển thị <span className="font-semibold text-gray-600">{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)}</span> / <span className="font-semibold text-gray-600">{total}</span> sản phẩm
              </p>
            )}

            {/* Scrollable grid area */}
            <div className="overflow-y-auto max-h-[calc(100vh-280px)] [&::-webkit-scrollbar]:hidden">
            {loading ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="overflow-hidden rounded-2xl border border-[#006241]/10 bg-white shadow-sm">
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
              <div className="flex flex-col items-center justify-center rounded-3xl bg-white py-24 text-center shadow-sm">
                <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full" style={{ background: '#d4e9e2' }}>
                  <Leaf size={36} style={{ color: '#006241' }} />
                </div>
                <h3 className="text-lg font-black text-[#1E3932]">Không tìm thấy sản phẩm</h3>
                <p className="mt-2 max-w-xs text-sm text-gray-400">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm để xem thêm sản phẩm.</p>
                <button onClick={() => { setLocalSearch(''); setLocalPriceMin(''); setLocalPriceMax(''); setSearchParams(new URLSearchParams()); }}
                  className="mt-6 rounded-full px-6 py-2.5 text-sm font-bold text-white shadow-sm transition active:scale-95" style={{ background: '#006241' }}>
                  Xóa bộ lọc
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {products.map((product) => {
                  const base = Number(product.basePrice);
                  const effective = Number(product.effectivePrice);
                  const hasDiscount = effective < base - 0.01;
                  const discountPct = calcDiscountPct(base, effective);
                  const isWishlisted = wishlistedIds.has(product.productId);
                  const outOfStock = product.quantityAvailable === 0;
                  const rating = Number(product.ratingAverage ?? 0);
                  const lowStock = !outOfStock && product.quantityAvailable <= 10;

                  return (
                    <div key={product.productId}
                      className="group flex flex-col overflow-hidden rounded-2xl border border-[#006241]/12 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#006241]/30 hover:shadow-lg">
                      {/* Image area */}
                      <div className="relative overflow-hidden bg-gray-50" style={{ aspectRatio: '4/3' }}>
                        <Link to={`/client/products/${product.productId}`}>
                          {product.primaryImageUrl ? (
                            <img
                              src={product.primaryImageUrl}
                              alt={product.productName}
                              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center" style={{ background: '#f2f0eb' }}>
                              <Leaf size={36} className="opacity-20" style={{ color: '#006241' }} />
                            </div>
                          )}
                        </Link>

                        {/* Gradient overlay at bottom */}
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/20 to-transparent" />

                        {/* Discount badge */}
                        {hasDiscount && discountPct > 0 && (
                          <div className="absolute left-3 top-3">
                            <span className="rounded-full bg-red-500 px-2.5 py-1 text-[11px] font-black text-white shadow-md">
                              -{discountPct}%
                            </span>
                          </div>
                        )}

                        {/* Wishlist */}
                        <button
                          onClick={() => void handleToggleWishlist(product.productId)}
                          disabled={togglingWishlistId === product.productId}
                          className={`absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full shadow-md transition-all ${
                            isWishlisted
                              ? 'bg-red-50 text-red-500'
                              : 'bg-white/95 text-gray-400 opacity-0 group-hover:opacity-100 hover:text-red-400'
                          }`}
                        >
                          <Heart size={14} fill={isWishlisted ? 'currentColor' : 'none'} />
                        </button>

                        {/* Out of stock overlay */}
                        {outOfStock && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
                            <span className="rounded-full bg-white px-4 py-1.5 text-xs font-black text-gray-800 shadow-lg">Hết hàng</span>
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex flex-1 flex-col p-4">
                        <div className="flex-1">
                          {product.category && (
                            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: '#006241' }}>
                              {product.category.categoryName}
                            </p>
                          )}

                          <Link
                            to={`/client/products/${product.productId}`}
                            className="block text-sm font-bold leading-snug text-[#1E3932] transition hover:text-[#006241] line-clamp-2"
                          >
                            {product.productName}
                          </Link>

                          {rating > 0 && (
                            <div className="mt-1.5 flex items-center gap-1">
                              <div className="flex">
                                {[1, 2, 3, 4, 5].map((s) => (
                                  <Star key={s} size={10}
                                    fill={s <= Math.round(rating) ? '#f59e0b' : 'none'}
                                    className={s <= Math.round(rating) ? 'text-amber-400' : 'text-gray-200'}
                                  />
                                ))}
                              </div>
                              {product.ratingCount > 0 && (
                                <span className="text-[10px] text-gray-400">({product.ratingCount})</span>
                              )}
                            </div>
                          )}

                          {product.origin && (
                            <p className="mt-1 text-[10px] text-gray-400">📍 {product.origin.originName}</p>
                          )}
                        </div>

                        {/* Price + actions */}
                        <div className="mt-3 border-t border-black/5 pt-3">
                          <div className="mb-3">
                            <div className="flex flex-wrap items-baseline gap-1.5">
                              <span className="text-base font-black tracking-tight" style={{ color: '#006241' }}>
                                {formatPrice(effective)}
                              </span>
                              {hasDiscount && (
                                <span className="text-xs text-gray-400 line-through">{formatPrice(base)}</span>
                              )}
                            </div>
                            {product.unit && (
                              <p className="text-[10px] text-gray-400">/ {product.unit}</p>
                            )}
                            {lowStock && (
                              <p className="mt-0.5 text-[10px] font-semibold text-orange-500">
                                Còn {product.quantityAvailable} sản phẩm
                              </p>
                            )}
                          </div>

                          <div className="flex gap-2">
                            <Link
                              to={`/client/products/${product.productId}`}
                              className="flex items-center justify-center rounded-xl border-2 px-3 py-2 text-xs font-bold transition hover:bg-[#006241] hover:text-white"
                              style={{ borderColor: '#006241', color: '#006241' }}
                            >
                              Xem
                            </Link>
                            <button
                              disabled={addingId === product.productId || outOfStock}
                              onClick={(e) => void handleAddToCart(product.productId, e)}
                              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold text-white transition disabled:opacity-50 active:scale-95"
                              style={{ background: outOfStock ? '#9ca3af' : '#00754A' }}
                            >
                              {addingId === product.productId ? (
                                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                              ) : (
                                <>
                                  <ShoppingCart size={12} />
                                  <span>Thêm vào giỏ</span>
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

            {renderPagination()}
          </div>
        </div>
      </div>
    </div>
  );
}
