import { useState, useEffect, useCallback } from 'react';
import { clientApi } from '../lib/client-api';
import { useClientSession } from './useClientSession';

export type CartItem = {
  id: string;
  productId: string;
  productName: string;
  primaryImageUrl: string | null;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
  availableQuantity: number | null;
};

export type Cart = {
  id: string;
  items: CartItem[];
  totalItems: number;
  totalQuantity: number;
  totalAmount: string;
};

let globalCartListeners = new Set<() => void>();
let globalCart: Cart | null = null;

function emitCartChange() {
  for (const l of globalCartListeners) l();
}

export async function refreshGlobalCart() {
  try {
    const data = await clientApi.get<Cart>('/cart');
    globalCart = data;
  } catch {
    globalCart = null;
  }
  emitCartChange();
}

export function useCart() {
  const { session } = useClientSession();
  const [cart, setCart] = useState<Cart | null>(globalCart);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const listener = () => setCart(globalCart);
    globalCartListeners.add(listener);
    return () => { globalCartListeners.delete(listener); };
  }, []);

  const fetchCart = useCallback(async () => {
    if (!session) {
      globalCart = null;
      emitCartChange();
      return;
    }
    setLoading(true);
    try {
      const data = await clientApi.get<Cart>('/cart');
      globalCart = data;
      emitCartChange();
    } catch {
      globalCart = null;
      emitCartChange();
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (session && !globalCart) {
      void fetchCart();
    } else if (!session) {
      globalCart = null;
      emitCartChange();
    }
  }, [session, fetchCart]);

  const addItem = useCallback(
    async (productId: string, quantity: number) => {
      await clientApi.post('/cart/items', { productId, quantity });
      await fetchCart();
    },
    [fetchCart],
  );

  const updateItem = useCallback(
    async (itemId: string, quantity: number) => {
      await clientApi.patch(`/cart/items/${itemId}`, { quantity });
      await fetchCart();
    },
    [fetchCart],
  );

  const removeItem = useCallback(
    async (itemId: string) => {
      await clientApi.delete(`/cart/items/${itemId}`);
      await fetchCart();
    },
    [fetchCart],
  );

  return { cart, loading, fetchCart, addItem, updateItem, removeItem };
}
