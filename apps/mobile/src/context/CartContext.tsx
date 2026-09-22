import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as cartApi from '../api/cart';
import { Cart } from '../api/types';
import { useAuth } from './AuthContext';

interface CartContextValue {
  cart: Cart | null;
  itemCount: number;
  isLoading: boolean;
  refresh: () => Promise<void>;
  addItem: (productId: number, quantity: number) => Promise<{ wasCapped: boolean }>;
  setQuantity: (productId: number, quantity: number) => Promise<{ wasCapped: boolean }>;
  removeItem: (productId: number) => Promise<void>;
  clear: () => Promise<void>;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [cart, setCart] = useState<Cart | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setCart(null);
      return;
    }
    setIsLoading(true);
    try {
      setCart(await cartApi.getCart());
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addItem = useCallback(async (productId: number, quantity: number) => {
    const result = await cartApi.addToCart(productId, quantity);
    await refresh();
    return { wasCapped: result.wasCapped };
  }, [refresh]);

  const setQuantity = useCallback(async (productId: number, quantity: number) => {
    const result = await cartApi.setCartItemQuantity(productId, quantity);
    await refresh();
    return { wasCapped: result.wasCapped };
  }, [refresh]);

  const removeItem = useCallback(async (productId: number) => {
    await cartApi.removeCartItem(productId);
    await refresh();
  }, [refresh]);

  const clear = useCallback(async () => {
    await cartApi.clearCart();
    setCart(null);
  }, []);

  const itemCount = cart?.items.reduce((sum, i) => sum + i.quantity, 0) ?? 0;

  const value = useMemo(
    () => ({ cart, itemCount, isLoading, refresh, addItem, setQuantity, removeItem, clear }),
    [cart, itemCount, isLoading, refresh, addItem, setQuantity, removeItem, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
}
