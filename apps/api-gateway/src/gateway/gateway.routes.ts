export type AuthLevel = 'public' | 'authenticated' | 'admin';

export interface RouteRule {
  /** Matched against the path with the leading /api stripped, e.g. "/orders". */
  prefix: string;
  target: string;
  auth: AuthLevel;
}

const PRODUCTS_URL = process.env.PRODUCTS_URL ?? 'http://localhost:3002';
const INVENTORY_URL = process.env.INVENTORY_URL ?? 'http://localhost:3003';
const CART_URL = process.env.CART_URL ?? 'http://localhost:3004';
const PRODUCT_IMAGE_URL = process.env.PRODUCT_IMAGE_URL ?? 'http://localhost:3005';
const USERS_URL = process.env.USERS_URL ?? 'http://localhost:3006';
const ORDERS_URL = process.env.ORDERS_URL ?? 'http://localhost:3007';

/**
 * Prefix-level routing and auth policy. None of these prefixes are a
 * prefix of one another (e.g. "/admin/orders" vs "/orders" are simply
 * different strings), so match order doesn't matter — the first (only)
 * one that matches wins.
 */
export const ROUTES: RouteRule[] = [
  { prefix: '/admin/products', target: PRODUCTS_URL, auth: 'admin' },
  { prefix: '/admin/categories', target: PRODUCTS_URL, auth: 'admin' },
  { prefix: '/admin/inventory', target: INVENTORY_URL, auth: 'admin' },
  { prefix: '/admin/orders', target: ORDERS_URL, auth: 'admin' },
  { prefix: '/auth', target: USERS_URL, auth: 'public' },
  { prefix: '/me', target: USERS_URL, auth: 'authenticated' },
  { prefix: '/products', target: PRODUCTS_URL, auth: 'public' },
  { prefix: '/categories', target: PRODUCTS_URL, auth: 'public' },
  { prefix: '/inventory', target: INVENTORY_URL, auth: 'public' },
  { prefix: '/cart', target: CART_URL, auth: 'authenticated' },
  { prefix: '/orders', target: ORDERS_URL, auth: 'authenticated' },
  { prefix: '/upload', target: PRODUCT_IMAGE_URL, auth: 'admin' },
  { prefix: '/media', target: PRODUCT_IMAGE_URL, auth: 'public' },
];

export function matchRoute(path: string): RouteRule | undefined {
  return ROUTES.find((r) => path === r.prefix || path.startsWith(r.prefix + '/'));
}
