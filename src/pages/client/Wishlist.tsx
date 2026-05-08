import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, Leaf, ShoppingCart, Trash2, ArrowRight } from 'lucide-react';
import { clientApi } from '../../lib/client-api';
import { useClientSession } from '../../hooks/useClientSession';
import { useCart } from '../../hooks/useCart';

type WishlistProduct = {
  productId: string;
  productName: string;
  productPrice: string;
  effectivePrice: string;
  basePrice: string;
  unit: string | null;
  quantityAvailable: number;
  primaryImageUrl: string | null;
  category: { categoryId: string; categoryName: string } | null;
  appliedDiscount: { name: string; value: string } | null;
  ratingAverage: string;
  ratingCount: number;
};

type WishlistItem = {
  productId: string;
  createdAt: string;
  product: WishlistProduct | null;
};

function formatPrice(val: number | string) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(val));
}

export default function Wishlist() {
  const navigate = useNavigate();
  const { session } = useClientSession();
  const { addItem } = useCart();

  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingCart, setAddingCart] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    if (!session) { void navigate('/client/login'); return; }
    setLoading(true);
    void clientApi
      .get<WishlistItem[]>('/wishlist')
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session, navigate]);

  const handleRemove = async (productId: string) => {
    setRemovingId(productId);
    try {
      await clientApi.delete(`/wishlist/${productId}`);
      setItems((prev) => prev.filter((item) => item.productId !== productId));
    } catch {}
    setRemovingId(null);
  };

  const handleAddToCart = async (productId: string) => {
    if (!session) { void navigate('/client/login'); return; }
    setAddingCart(productId);
    try {
      await addItem(productId, 1);
    } finally {
      setAddingCart(null);
    }
  };

  if (loading) {
    return (
      <div className="client-surface flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#006241] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="client-surface min-h-[80vh]">
      <div className="mx-auto max-w-5xl px-4 py-10 lg:px-6">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em]" style={{ color: '#006241' }}>
              Cá nhân
            </p>
            <h1 className="mt-1 flex items-center gap-2.5 text-3xl font-black text-[#1E3932]">
              <Heart size={28} className="text-pink-400" fill="currentColor" />
              Sản phẩm yêu thích
            </h1>
          </div>
          <Link to="/client/account" className="text-sm font-semibold text-[#006241] hover:underline">
            ← Tài khoản
          </Link>
        </div>

        {items.length === 0 ? (
          <div className="client-card flex flex-col items-center justify-center py-20 text-center">
            <Heart size={52} className="mb-4 text-pink-200" />
            <h2 className="font-black text-[#1E3932]">Chưa có sản phẩm yêu thích</h2>
            <p className="mt-1 text-sm text-gray-500">Lưu sản phẩm bạn thích để xem lại sau</p>
            <Link
              to="/client/products"
              className="client-pill-primary mt-5 inline-flex items-center gap-2 px-6 py-3 text-sm font-bold"
            >
              <Leaf size={16} /> Khám phá sản phẩm
            </Link>
          </div>
        ) : (
          <>
            <p className="mb-4 text-sm text-gray-500">{items.length} sản phẩm đã lưu</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map(({ productId, product }) => {
                if (!product) return null;
                const hasDiscount = product.appliedDiscount !== null &&
                  Number(product.effectivePrice) < Number(product.basePrice);
                const discountPct = hasDiscount
                  ? Math.round((1 - Number(product.effectivePrice) / Number(product.basePrice)) * 100)
                  : 0;
                return (
                  <div
                    key={productId}
                    className="client-card-soft group relative overflow-hidden transition-all"
                  >
                    {/* Remove button */}
                    <button
                      onClick={() => void handleRemove(productId)}
                      disabled={removingId === productId}
                      className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-gray-400 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
                    >
                      <Trash2 size={13} />
                    </button>

                    {/* Discount badge */}
                    {hasDiscount && discountPct > 0 && (
                      <div className="absolute left-3 top-3 z-10 rounded-full bg-[#c82014] px-2 py-0.5 text-[10px] font-black text-white">
                        -{discountPct}%
                      </div>
                    )}

                    <Link to={`/client/products/${productId}`}>
                      <div className="overflow-hidden bg-[#f2f0eb]">
                        {product.primaryImageUrl ? (
                          <img
                            src={product.primaryImageUrl}
                            alt={product.productName}
                            className="h-44 w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-44 items-center justify-center">
                            <Leaf size={40} className="text-[#006241]/20" />
                          </div>
                        )}
                      </div>
                    </Link>

                    <div className="p-4">
                      {product.category && (
                        <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[#006241]">
                          {product.category.categoryName}
                        </p>
                      )}
                      <Link to={`/client/products/${productId}`}>
                        <p className="line-clamp-2 text-sm font-bold leading-snug text-[#1E3932] hover:text-[#006241]">
                          {product.productName}
                        </p>
                      </Link>

                      <div className="mt-2 flex items-center justify-between">
                        <div>
                          <p className="text-base font-black text-[#006241]">
                            {formatPrice(product.effectivePrice)}
                          </p>
                          {hasDiscount && (
                            <p className="text-xs text-gray-400 line-through">
                              {formatPrice(product.basePrice)}
                            </p>
                          )}
                        </div>
                        {product.quantityAvailable === 0 && (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">
                            Hết hàng
                          </span>
                        )}
                      </div>

                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => void handleAddToCart(productId)}
                          disabled={addingCart === productId || product.quantityAvailable === 0}
                          className="client-pill-outline flex flex-1 items-center justify-center gap-1.5 py-2 text-xs font-bold disabled:opacity-40"
                        >
                          <ShoppingCart size={13} />
                          {addingCart === productId ? 'Đang thêm...' : 'Thêm vào giỏ'}
                        </button>
                        <Link
                          to={`/client/products/${productId}`}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black/10 text-gray-400 transition hover:border-[#006241] hover:text-[#006241]"
                        >
                          <ArrowRight size={13} />
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
