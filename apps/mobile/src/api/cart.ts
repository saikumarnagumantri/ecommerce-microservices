import { apiClient } from './client';
import { Cart } from './types';

export const getCart = (): Promise<Cart> => apiClient.get('/cart').then((r) => r.data);

export const addToCart = (productId: number, quantity: number) =>
  apiClient.post('/cart/items', { productId, quantity }).then((r) => r.data as { quantity: number; wasCapped: boolean });

export const setCartItemQuantity = (productId: number, quantity: number) =>
  apiClient
    .patch(`/cart/items/${productId}`, { quantity })
    .then((r) => r.data as { quantity: number; wasCapped: boolean });

export const removeCartItem = (productId: number): Promise<void> =>
  apiClient.delete(`/cart/items/${productId}`).then(() => undefined);

export const clearCart = (): Promise<void> => apiClient.delete('/cart').then(() => undefined);
