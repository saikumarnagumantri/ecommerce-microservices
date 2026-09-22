# SalesCart — Sprint 1 (Full Application)

**Sprint goal:** Ship a working e-commerce application end to end: customers register, log in, browse products (with features, images and videos), add to cart and place orders on a mobile app. Admins manage products, inventory and orders (dispatch and tracking) from a web dashboard.

**Status legend:** `[x]` done, `[ ]` to do. Points use Fibonacci (1, 2, 3, 5, 8).

---

## 1. Architecture decisions

| Decision | Choice | Why |
|---|---|---|
| Backend | NestJS microservices (existing monorepo in `apps/`) | Already in place |
| Database | PostgreSQL 16 via TypeORM, **one database schema per service** | Service isolation without running many DB servers |
| Auth | JWT (access token, 1h) + roles `CUSTOMER` / `ADMIN`, bcrypt password hashing | Simple, stateless, works for mobile and web |
| Entry point | `api-gateway` is the only service clients call; it verifies JWT and proxies | One CORS and auth surface |
| Service-to-service | HTTP with an internal API key header (`x-internal-key`) | Downstream services are not exposed publicly |
| Media | `product-image` service stores files on disk, serves `/media/*`; DB stores URLs | Images and videos with no external cloud dependency |
| Mobile | React Native + Expo (TypeScript) in `apps/mobile` | Chosen |
| Admin | React + Vite (TypeScript) in `apps/admin-web`; replaces empty NestJS `apps/admin` | Chosen |
| Shared code | `libs/common` (DTO validation pipe, error filter, JWT guard, roles decorator, pagination) | Avoids duplicating cross-cutting code in 7 services |

### Services and ports

| Service | Port | Owns |
|---|---|---|
| admin-web (Vite) | 5173 | Admin UI |
| api-gateway | 3001 | Routing, auth check, product-detail aggregation |
| products | 3002 | Products, categories, features, media references |
| inventory | 3003 | Stock levels, reservations |
| cart | 3004 | Carts |
| product-image | 3005 | File upload and static media |
| users | 3006 | Users, credentials, addresses |
| orders (new) | 3007 | Orders, status history, tracking |
| Postgres / Redis | 5432 / 6379 | Data / optional cache |

### Data model (summary)

- **users**: id, email (unique), passwordHash, name, phone, role, createdAt. **addresses**: id, userId, line1, line2, city, state, postalCode, country, isDefault.
- **categories**: id, name, parentId.
- **products**: id, name, description, categoryId, brand, originalPrice, discountPrice, isActive, createdAt.
- **product_features**: id, productId, label, value, sortOrder (e.g. `Battery: 20h`).
- **product_media**: id, productId, type (`IMAGE` | `VIDEO`), url, sortOrder, isPrimary.
- **inventory**: productId (PK), stock, reserved, updatedAt. **inventory_movements**: id, productId, delta, reason (`RESTOCK` | `ORDER` | `CANCEL` | `ADJUST`), refId, createdAt.
- **carts / cart_items**: userId, productId, quantity (unique per userId+productId).
- **orders**: id, userId, status, totalAmount, shippingAddress (snapshot JSON), paymentMethod, createdAt. **order_items**: orderId, productId, name and price snapshots, quantity. **order_events**: orderId, status, note, actorId, createdAt. **shipments**: orderId, carrier, trackingNumber, dispatchedAt, deliveredAt.

### Order status machine

`PLACED → CONFIRMED → DISPATCHED → DELIVERED`; `PLACED | CONFIRMED → CANCELLED`. Any other transition is rejected with 409. Every transition writes an `order_events` row. Cancelling releases the stock.

### Key API surface (via gateway, prefix `/api`)

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /me`, `PATCH /me`, `GET/POST/PATCH/DELETE /me/addresses` |
| Catalog (public) | `GET /products?search&category&page`, `GET /products/:id` (detail with features, media and stock), `GET /categories` |
| Cart (customer) | `GET /cart`, `POST /cart/items`, `PATCH /cart/items/:productId`, `DELETE /cart/items/:productId`, `DELETE /cart` |
| Orders (customer) | `POST /orders` (from cart), `GET /orders`, `GET /orders/:id` (with events and tracking), `POST /orders/:id/cancel` |
| Admin | `POST/PATCH/DELETE /admin/products`, `PUT /admin/products/:id/features`, `POST /admin/products/:id/media`, `GET/PATCH /admin/inventory`, `POST /admin/inventory/:productId/restock`, `GET /admin/orders?status`, `PATCH /admin/orders/:id/status`, `POST /admin/orders/:id/dispatch` |

---

## 2. Epics and stories

### EPIC 0 — Foundation and hardening of existing services

| ID | Story | Pts | Acceptance criteria |
|---|---|---|---|
| E0-1 | [x] Fix inventory, cart and product bugs from code review | 3 | Stock DTO correct, route order fixed, cart URLs and mutations work, verified by running services |
| E0-2 | [x] Docker Compose runs Postgres and Redis; `.env.example` per service | 2 | `npm run start:infra` brings up DB; every service reads config from env |
| E0-3 | [x] `libs/common`: validation pipe, exception filter, JWT guard, `@Roles()` guard, internal-key guard, pagination helper | 5 | Imported by all services; unit tests for guards |
| E0-4 | [x] Replace in-memory data with TypeORM entities and migrations in products, inventory, cart | 5 | Data survives restart; seed script loads sample catalog |
| E0-5 | [x] Root scripts: `start:all`, `test:all`, `build:all` include new services | 2 | One command starts everything on Windows |

### EPIC 1 — Identity (users service)

| ID | Story | Pts | Acceptance criteria |
|---|---|---|---|
| E1-1 | [ ] As a visitor I can register with email, password, name | 3 | Duplicate email returns 409; password is bcrypt-hashed; never returned in responses; password min 8 chars |
| E1-2 | [ ] As a user I can log in and receive a JWT | 3 | Wrong credentials return 401 with a generic message; token carries `sub` and `role` |
| E1-3 | [ ] As a user I can view and update my profile | 2 | Requires JWT; cannot change own role |
| E1-4 | [ ] As a customer I can manage delivery addresses | 3 | CRUD; exactly one default; only my own addresses visible |
| E1-5 | [ ] Seed an admin account from env vars | 1 | Admin exists after first boot; role cannot be set via public registration |

### EPIC 2 — Catalog: products, features, media

| ID | Story | Pts | Acceptance criteria |
|---|---|---|---|
| E2-1 | [ ] Products and categories persisted with pagination, search and category filter | 5 | `GET /products` returns page metadata; inactive products hidden from customers |
| E2-2 | [ ] Product features (label/value list) stored and returned | 3 | Ordered by `sortOrder`; admin can replace the whole list |
| E2-3 | [ ] Product media (images and videos) with ordering and a primary image | 3 | Detail returns media array with type and URL |
| E2-4 | [ ] Media upload endpoint | 5 | Accepts jpg, png, webp, mp4 (size limits: 5 MB image, 50 MB video); rejects other types; returns a served URL |
| E2-5 | [ ] Product detail aggregates product, features, media and live stock at the gateway | 3 | One call returns everything the detail screen needs; degrades gracefully if inventory is down |
| E2-6 | [ ] Admin product CRUD (create, update, soft-delete) | 5 | Admin-only; validation on price (discount ≤ original); creating a product also creates its inventory row |

### EPIC 3 — Inventory

| ID | Story | Pts | Acceptance criteria |
|---|---|---|---|
| E3-1 | [ ] Inventory persisted with movement history | 3 | Every change writes an `inventory_movements` row |
| E3-2 | [ ] Admin can restock and adjust stock | 3 | Admin-only; negative stock rejected |
| E3-3 | [ ] Atomic reserve and release for orders | 5 | Runs in one DB transaction; multi-item all-or-nothing; concurrent orders cannot oversell (row lock); tested with parallel requests |
| E3-4 | [ ] Admin low-stock list | 2 | Filter by threshold |

### EPIC 4 — Cart

| ID | Story | Pts | Acceptance criteria |
|---|---|---|---|
| E4-1 | [ ] Cart is tied to the authenticated user (no `userId` in URL or body) | 3 | Users cannot read or modify another user's cart |
| E4-2 | [ ] Add, update quantity, remove, clear | 3 | Adding an existing product merges quantity; quantity 0 removes; quantity capped by available stock |
| E4-3 | [ ] Cart view shows current price, subtotal, availability | 2 | Prices always read live from products; unavailable items flagged |

### EPIC 5 — Orders and tracking

| ID | Story | Pts | Acceptance criteria |
|---|---|---|---|
| E5-1 | [ ] Orders service scaffold, entities, migrations | 3 | Runs on port 3007 with Swagger |
| E5-2 | [ ] Place order from cart with chosen address | 8 | Validates stock, reserves it, snapshots price and address, clears cart; a failure at any step rolls back stock; response contains order id |
| E5-3 | [ ] Customer order list and detail with status timeline and tracking | 3 | Only own orders; timeline from `order_events` |
| E5-4 | [ ] Customer can cancel while PLACED or CONFIRMED | 3 | Stock released; illegal transitions return 409 |
| E5-5 | [ ] Admin order list with status filter and search | 3 | Pagination; filter by status and date |
| E5-6 | [ ] Admin confirms, dispatches (carrier + tracking number) and marks delivered | 5 | State machine enforced; each transition recorded with actor and time |
| E5-7 | [ ] Payment: Cash on Delivery only in this sprint (payment gateway is out of scope) | 1 | `paymentMethod = COD`; the field is ready for a future provider |

### EPIC 6 — API gateway

| ID | Story | Pts | Acceptance criteria |
|---|---|---|---|
| E6-1 | [ ] Route `/api/*` to services, forward user identity headers | 5 | Downstream services reject calls without the internal key |
| E6-2 | [ ] JWT verification and role enforcement (`ADMIN` routes) | 3 | 401 unauthenticated, 403 wrong role |
| E6-3 | [ ] CORS for web and mobile, request logging, rate limit on login/register | 3 | Throttling returns 429 |
| E6-4 | [ ] Unified Swagger docs at `/api/docs` | 2 | All public endpoints documented |

### EPIC 7 — Mobile app (Expo, customer)

| ID | Story | Pts | Acceptance criteria |
|---|---|---|---|
| E7-1 | [ ] Project setup, navigation, API client with token storage (SecureStore) | 3 | Token attached to requests; 401 sends the user to login |
| E7-2 | [ ] Register and login screens with validation | 3 | Field errors shown; session persists across restarts |
| E7-3 | [ ] Product list: search, category filter, infinite scroll | 5 | Shows primary image, price, discount, out-of-stock badge |
| E7-4 | [ ] Product detail: media carousel (images and video playback), price and offers, feature table, stock status | 8 | Swipe between images and videos; features listed beside the media; add-to-cart button disabled when out of stock |
| E7-5 | [ ] Cart screen: change quantity, remove, totals | 3 | Reflects backend state |
| E7-6 | [ ] Checkout: select or add address, review, place order | 5 | Success screen with order id; error message if stock ran out |
| E7-7 | [ ] My orders list and detail with status timeline and tracking number | 5 | Cancel button when allowed |
| E7-8 | [ ] Profile and logout | 2 | Edit name and phone |

### EPIC 8 — Admin web (React + Vite)

| ID | Story | Pts | Acceptance criteria |
|---|---|---|---|
| E8-1 | [ ] Setup, admin login, route guard | 3 | Non-admin users are rejected |
| E8-2 | [ ] Product list and create/edit form (details, price, category) | 5 | Validation matches the backend |
| E8-3 | [ ] Feature editor (add, reorder, remove rows) | 3 | Saved via one call |
| E8-4 | [ ] Media manager: upload images and videos, set primary, reorder, delete | 5 | Previews shown; upload progress and errors |
| E8-5 | [ ] Inventory page: view stock, restock, adjust, low-stock highlight | 3 | Shows movement history per product |
| E8-6 | [ ] Orders page: filter by status, order detail | 5 | Shows items, address, timeline |
| E8-7 | [ ] Order actions: confirm, dispatch (carrier + tracking number), mark delivered, cancel | 5 | Only valid actions shown for the current status |

### EPIC 9 — Quality and delivery

| ID | Story | Pts | Acceptance criteria |
|---|---|---|---|
| E9-1 | [ ] Unit tests for services with business rules (auth, stock reservation, order state machine) | 5 | Rules above covered, including failure paths |
| E9-2 | [ ] E2E happy path against running stack: register → browse → cart → order → admin dispatch → customer sees tracking | 5 | Scripted, runs in one command |
| E9-3 | [ ] Security pass: password handling, role checks on every admin route, no secrets in git, input validation | 3 | `security-review` findings resolved |
| E9-4 | [ ] README with setup, ports, env vars, seed data, demo accounts | 2 | A new developer can run the stack from the README |

**Total: 191 points across 10 epics (E0–E9) and 53 stories.**

---

## 3. Execution order inside the sprint

The stories depend on each other, so work goes in this order. Each step ends with a running, verified slice.

1. **Foundation:** E0-2, E0-3, E0-4, E0-5.
2. **Identity:** E1-1 to E1-5.
3. **Catalog and inventory backend:** E2-1 to E2-4, E2-6, then E3-1 to E3-4.
4. **Cart and orders backend:** E4-1 to E4-3, then E5-1 to E5-7.
5. **Gateway:** E6-1 to E6-4, and E2-5 (product-detail aggregation).
6. **Front ends:** E7 and E8 can run in parallel once the gateway is up.
7. **Quality:** E9-1 to E9-4, with unit tests written alongside each backend story rather than at the end.

## 4. Definition of Done (every story)

- Acceptance criteria met and demonstrated by running the service or app.
- Unit tests for business rules pass, and the service builds with `tsc` and no errors.
- Endpoints validated (DTOs) and documented in Swagger.
- Admin routes protected by role checks.
- No secrets committed; config comes from env.
- Docs updated where behaviour changed.

## 5. Out of scope for this sprint

Online payments (Stripe, Razorpay), email/SMS notifications, product reviews, wishlists, coupons and bank-card offers at checkout, multi-warehouse inventory, refunds, push notifications, and app-store deployment. The `paymentMethod` field, the order-events model and the `offers` field on products leave room to add these later.

## 6. Risks and assumptions

| Risk or assumption | Mitigation |
|---|---|
| Sprint is very large for one iteration (191 pts) | Execution order above keeps every step shippable; backend first so the front ends never wait on it |
| Overselling under concurrent orders | Row-level lock in the reservation transaction (E3-3), covered by a parallel test |
| Order placement spans services (no distributed transaction) | Reserve stock first, create the order, and release the reservation on any failure (compensation) |
| Video files are large | Size limits, and files are served with range requests so playback streams |
| Windows dev environment | Scripts avoid POSIX-only commands; Docker needed for Postgres |
| Assumes Docker is available (v29 detected) and Node 20 | Confirmed on this machine |
