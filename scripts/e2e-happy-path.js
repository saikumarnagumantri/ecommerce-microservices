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
  const dispatched = await call('POST', `/admin/orders/${order.id}/dispatch`, { carrier: 'BlueDart', trackingNumber, dispatchedProductIds: [product.id] }, adminToken);
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

  step('Second scenario: place a two-item order and partially dispatch it');
  const stamp2 = Date.now();
  const email2 = `e2e-partial-${stamp2}@example.com`;
  const password2 = 'password123';
  await call('POST', '/auth/register', { email: email2, password: password2, name: 'E2E Partial Customer' });
  const { accessToken: customer2Token } = await call('POST', '/auth/login', { email: email2, password: password2 });

  const catalog2 = await call('GET', '/products?limit=2');
  assert(catalog2.data.length >= 2, 'catalog has at least two products for the partial-dispatch scenario');
  const [productA, productB] = catalog2.data;

  await call('POST', `/admin/inventory/${productA.id}/restock`, { quantity: 10 }, adminToken);
  await call('POST', `/admin/inventory/${productB.id}/restock`, { quantity: 10 }, adminToken);

  const address2 = await call('POST', '/me/addresses', {
    line1: '2 E2E Partial Street',
    city: 'Pune',
    state: 'MH',
    postalCode: '411001',
    country: 'India',
  }, customer2Token);

  await call('POST', '/cart/items', { productId: productA.id, quantity: 1 }, customer2Token);
  await call('POST', '/cart/items', { productId: productB.id, quantity: 1 }, customer2Token);
  const order2 = await call('POST', '/orders', { addressId: address2.id }, customer2Token);

  await call('PATCH', `/admin/orders/${order2.id}/confirm`, undefined, adminToken);
  const partial = await call(
    'POST',
    `/admin/orders/${order2.id}/dispatch`,
    { carrier: 'BlueDart', trackingNumber: `PARTIAL${stamp2}`, dispatchedProductIds: [productA.id], reason: 'OUT_OF_STOCK', comment: 'Product B ran out during packing' },
    adminToken,
  );
  assert(partial.status === 'PARTIALLY_DISPATCHED', 'order moved to PARTIALLY_DISPATCHED');
  assert(partial.items.find((i) => i.productId === productA.id).dispatchStatus === 'DISPATCHED', 'dispatched item is marked DISPATCHED');
  assert(partial.items.find((i) => i.productId === productB.id).dispatchStatus === 'UNAVAILABLE', 'held-back item is marked UNAVAILABLE');
  assert(partial.shipment.isPartial === true, 'shipment records isPartial');

  const delivered2 = await call('PATCH', `/admin/orders/${order2.id}/deliver`, undefined, adminToken);
  assert(delivered2.status === 'DELIVERED', 'partially dispatched order can still be marked DELIVERED');

  const ordersBeforeOpen = await call('GET', '/orders', undefined, customer2Token);
  assert(
    ordersBeforeOpen.data.find((o) => o.id === order2.id)?.hasUnseenUpdate === true,
    'the unseen flag is actually set before the customer opens the order (not a vacuous check)',
  );

  const customerView2 = await call('GET', `/orders/${order2.id}`, undefined, customer2Token);
  assert(customerView2.hasUnseenUpdate === false, "opening the order cleared the customer's unseen flag");

  console.log(`\nPASS — full happy path verified end to end (customer: ${customer.email}, order #${order.id}).`);
}

main().catch((err) => {
  console.error(`\nFAIL — ${err.message}`);
  process.exit(1);
});
