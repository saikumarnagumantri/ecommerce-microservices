#!/usr/bin/env node
/**
 * E9-2: the sprint's full happy path, run against the live stack through
 * the gateway only (the same single entry point a real client uses):
 *
 *   register -> browse -> add address -> add to cart -> place order
 *   -> admin confirms & dispatches -> customer sees the tracking number
 *
 * Usage: node scripts/e2e-happy-path.js
 * Requires the whole stack up (`npm run start:all` + Postgres/Redis) and
 * an admin account already seeded (ADMIN_EMAIL/ADMIN_PASSWORD in
 * apps/users/.env — see README).
 */

const BASE_URL = process.env.E2E_API_URL ?? 'http://localhost:3001/api';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@salescart.dev';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'ChangeMe123!';

let stepNum = 0;
function step(label) {
  stepNum += 1;
  console.log(`\n[${stepNum}] ${label}`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`    ok — ${message}`);
}

async function call(method, path, body, token) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = text;
  }
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

async function main() {
  const stamp = Date.now();
  const email = `e2e-${stamp}@example.com`;
  const password = 'password123';

  step(`Register a new customer (${email})`);
  const registered = await call('POST', '/auth/register', { email, password, name: 'E2E Customer' });
  assert(registered.role === 'CUSTOMER', 'new account is a CUSTOMER, never ADMIN');

  step('Log in as that customer');
  const { accessToken: customerToken, user: customer } = await call('POST', '/auth/login', { email, password });
  assert(typeof customerToken === 'string' && customerToken.length > 0, 'received a JWT');

  step('Browse the public catalog with no token');
  const catalog = await call('GET', '/products?limit=5');
  assert(catalog.data.length > 0, 'catalog returns at least one product');
  const product = catalog.data[0];
  assert(!!product, 'picked a product to order');

  step('Log in as admin');
  const { accessToken: adminToken, user: admin } = await call('POST', '/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  assert(admin.role === 'ADMIN', 'admin login returns an ADMIN role');

  step(`Restock "${product.name}" so this run never depends on stock other test runs left behind`);
  await call('POST', `/admin/inventory/${product.id}/restock`, { quantity: 100 }, adminToken);

  step('Add a delivery address');
  const address = await call('POST', '/me/addresses', {
    line1: '1 E2E Test Street',
    city: 'Pune',
    state: 'MH',
    postalCode: '411001',
    country: 'India',
  }, customerToken);
  assert(address.isDefault === true, 'first address becomes the default');

  step(`Add "${product.name}" to the cart`);
  await call('POST', '/cart/items', { productId: product.id, quantity: 1 }, customerToken);
  const cart = await call('GET', '/cart', undefined, customerToken);
  assert(cart.items.some((i) => i.productId === product.id), 'product is in the cart');

  step('Place the order');
  const order = await call('POST', '/orders', { addressId: address.id }, customerToken);
  assert(order.status === 'PLACED', 'order starts as PLACED');
  assert(order.id > 0, 'order has an id');

  const clearedCart = await call('GET', '/cart', undefined, customerToken);
  assert(clearedCart.items.length === 0, 'cart was cleared after placing the order');

  step(`Confirm order #${order.id}`);
  const confirmed = await call('PATCH', `/admin/orders/${order.id}/confirm`, undefined, adminToken);
  assert(confirmed.status === 'CONFIRMED', 'order moved to CONFIRMED');

  step('Dispatch the order with a carrier and tracking number');
  const trackingNumber = `E2E${stamp}`;
  const dispatched = await call('POST', `/admin/orders/${order.id}/dispatch`, { carrier: 'BlueDart', trackingNumber }, adminToken);
  assert(dispatched.status === 'DISPATCHED', 'order moved to DISPATCHED');
  assert(dispatched.shipment?.trackingNumber === trackingNumber, 'shipment carries the tracking number');

  step('Customer sees the tracking number on their own order');
  const customerView = await call('GET', `/orders/${order.id}`, undefined, customerToken);
  assert(customerView.status === 'DISPATCHED', 'customer sees DISPATCHED');
  assert(customerView.shipment?.trackingNumber === trackingNumber, 'customer sees the same tracking number');
  assert(customerView.events.map((e) => e.status).join(',') === 'PLACED,CONFIRMED,DISPATCHED', 'full timeline is present, in order');

  step('A tampered token is rejected outright');
  try {
    await call('GET', `/orders/${order.id}`, undefined, `${customerToken}tampered`);
    throw new Error('expected a 401 for a tampered token');
  } catch (err) {
    assert(String(err.message).includes('401'), 'tampered token is rejected');
  }

  console.log(`\nPASS — full happy path verified end to end (customer: ${customer.email}, order #${order.id}).`);
}

main().catch((err) => {
  console.error(`\nFAIL — ${err.message}`);
  process.exit(1);
});
