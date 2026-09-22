import axios from 'axios';
import { INTERNAL_KEY_HEADER } from '@salescart/common';

const CART_URL = process.env.CART_URL ?? 'http://localhost:3004/cart';

export interface CartItemSnapshot {
  productId: number;
  quantity: number;
  name: string;
  price: number;
  isAvailable: boolean;
}

export interface CartSnapshot {
  userId: number;
  items: CartItemSnapshot[];
  total: number;
}

function headers(authHeader: string) {
  return { authorization: authHeader, [INTERNAL_KEY_HEADER]: process.env.INTERNAL_API_KEY ?? '' };
}

/** Reads the calling user's own cart — forwards their bearer token, since cart still verifies it itself. */
export const getCart = async (authHeader: string): Promise<CartSnapshot> => {
  const res = await axios.get(CART_URL, { headers: headers(authHeader) });
  return res.data;
};

export const clearCart = async (authHeader: string): Promise<void> => {
  await axios.delete(CART_URL, { headers: headers(authHeader) });
};
