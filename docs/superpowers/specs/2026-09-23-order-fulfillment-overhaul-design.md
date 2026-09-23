# Order fulfillment overhaul — design spec

**Epic:** E10 (next after E9 · Quality, per `docs/sprint-1.md`)
**Status:** Approved for planning
**Depends on:** nothing outside `apps/orders`, `apps/admin-web`, `apps/mobile`

## Why

Today, dispatch is all-or-nothing: an admin marks the whole order `DISPATCHED`
with one carrier/tracking number. In practice, some items in a confirmed
order can be out of stock (or otherwise unable to ship) by the time the admin
packs it, and the admin currently has no way to ship what's available while
holding back the rest — they either dispatch the whole order (inaccurate) or
block the order until every item is available (slower for the customer).
Cancellation also currently records no reason, making it hard to see later
why an order was cancelled.

This spec adds partial dispatch (admin selects which items ship now), a
mandatory reason on both partial dispatch and cancellation, and an in-app way
for the customer to notice these changes without polling.

## Current state (for context)

- `Order.status` is a single enum: `PLACED → CONFIRMED → DISPATCHED → DELIVERED`,
  with `CANCELLED` reachable from `PLACED`/`CONFIRMED` only
  (`apps/orders/src/orders/entities/order.entity.ts`,
  `apps/orders/src/orders/constants/orders.constants.ts` for
  `ALLOWED_TRANSITIONS`).
- `OrderItem` has no per-item status — it's a price/name snapshot only
  (`apps/orders/src/orders/entities/order-item.entity.ts`).
- `Shipment` is one row per order (`orderId` is `unique`), holding
  `carrier`/`trackingNumber`/`dispatchedAt`/`deliveredAt`
  (`apps/orders/src/orders/entities/shipment.entity.ts`).
- All transitions go through `OrdersService.transition()`, which checks
  `ALLOWED_TRANSITIONS`, runs an optional side effect, updates `order.status`,
  and writes one `OrderEvent` row (`apps/orders/src/orders/orders.service.ts`).
- `admin-web`'s `OrderDetailPage.tsx` renders a status-conditional action
  panel (confirm / dispatch form / deliver / cancel) already following this
  exact pattern — the new UI extends it, not replaces it.
- There is no notification system anywhere in this codebase — no push, no
  email, no in-app inbox. The mobile app only shows order state when the
  customer opens `GET /orders/:id`.

## Data model changes

All in `apps/orders` (schema `orders`), via a new TypeORM migration:

1. **`OrderStatus`** (`order.entity.ts`) gains `PARTIALLY_DISPATCHED`.
   `ALLOWED_TRANSITIONS` updates:
   - `CONFIRMED → { DISPATCHED, PARTIALLY_DISPATCHED, CANCELLED }`
   - `DISPATCHED → { DELIVERED }` (unchanged)
   - `PARTIALLY_DISPATCHED → { DELIVERED }` (new — same as `DISPATCHED`;
     neither is cancellable, since nothing can be un-shipped once a courier
     has picked up part of the order)

2. **`OrderItem`** gains:
   - `dispatchStatus: 'PENDING' | 'DISPATCHED' | 'UNAVAILABLE'`, default
     `'PENDING'`.
   On dispatch, admin-selected items → `DISPATCHED`; every other item on the
   order → `UNAVAILABLE` (terminal — see "Dropped for good" below).

3. **`Shipment`** gains (all nullable, populated only when partial):
   - `isPartial: boolean` (default `false`)
   - `reason: varchar(64) | null`
   - `comment: text | null`

4. **`Order`** gains:
   - `hasUnseenUpdate: boolean`, default `false` — the in-app notification
     flag (see "Notifications" below).
   - `cancelReason: varchar(64) | null`
   - `cancelComment: text | null`

### Reason lists (fixed, validated server-side with `class-validator`'s `@IsIn`)

- **Partial-dispatch reason** (why held-back items weren't included):
  `OUT_OF_STOCK`, `ITEM_DAMAGED`, `ITEM_DISCONTINUED`,
  `COURIER_LIMIT`, `OTHER`
- **Cancellation reason** (admin-initiated only — see Scope):
  `CUSTOMER_REQUESTED`, `OUT_OF_STOCK`, `DUPLICATE_ORDER`,
  `SUSPECTED_FRAUD`, `UNDELIVERABLE_ADDRESS`, `OTHER`

These are plain string-literal unions, not a shared enum package — no code
in this repo currently shares runtime types between a NestJS service and a
frontend (`OrderStatus` itself is already duplicated as a literal union in
`apps/mobile/src/api/types.ts`). `admin-web` and `apps/mobile` each declare
their own copy of these two lists; the backend is the source of truth via
`@IsIn`.

### Dispatch is still one-time per order ("dropped for good")

An order gets exactly one dispatch action, same as today (`Shipment.orderId`
stays `unique`). Items excluded from that dispatch become `UNAVAILABLE`
permanently — their reserved stock is released (reusing the existing
`releaseStock` call cancellation already makes) and there is no later
"dispatch the rest" action for this order. A customer who wants the held-back
items has to place a new order once they're back in stock. This was chosen
over a multi-batch model (re-dispatchable orders, a shipments table keyed
many-to-one) to keep the data model and UI to one dispatch flow instead of an
open-ended fulfillment history — YAGNI unless partial dispatch turns out to
be common enough that customers need the remainder auto-fulfilled.

## API changes (`apps/orders`, behind the gateway's existing `/admin/orders`
routes — no gateway routing changes needed here)

### `POST /admin/orders/:id/dispatch`

`DispatchOrderDto` becomes:

```ts
{
  carrier: string;
  trackingNumber: string;
  dispatchedProductIds: number[]; // non-empty subset of this order's PENDING item productIds
  reason?: PartialDispatchReason;  // required iff dispatchedProductIds is a proper subset
  comment?: string;                // required iff reason is required; min length 1
}
```

Validation (service layer, since "required iff" can't be expressed with
`class-validator` decorators alone):
- `dispatchedProductIds` must be non-empty and every id must belong to the
  order and currently be `PENDING` — else 400.
- If `dispatchedProductIds.length` < the order's total `PENDING` item count:
  `reason` and non-empty `comment` are required (400 if missing) → order
  moves to `PARTIALLY_DISPATCHED`; excluded items → `UNAVAILABLE` with stock
  released.
- Otherwise (covers every pending item): order moves to `DISPATCHED`, as
  today.
- `OrderEvent.note` is built server-side, e.g. `"Partially dispatched: 2 of 3
  items shipped via BlueDart (BD123). 1 item unavailable — Out of stock:
  <comment>"` — this is what both admin-web's timeline and the mobile app's
  timeline render, unchanged on the client side.

### `PATCH /admin/orders/:id/deliver`

Unchanged request/response shape. `ALLOWED_TRANSITIONS` now permits this from
`PARTIALLY_DISPATCHED` as well as `DISPATCHED`.

### `POST /admin/orders/:id/cancel`

Body added: `{ reason: CancelReason; comment: string }` (comment min length
1, both required — 400 if missing). Stored on `Order.cancelReason` /
`Order.cancelComment` and folded into the `OrderEvent.note`, e.g.
`"Cancelled by admin — Out of stock: <comment>"`.

**Scope decision:** this reason/comment requirement applies to admin-initiated
cancellation only. The existing customer self-cancel
(`POST /orders/:id/cancel`, `OrdersService.cancelForUser`) is unchanged — no
reason required there.

### Notifications (in-app only)

- `hasUnseenUpdate` is set `true` inside `OrdersService.transition()`
  whenever the target status is `PARTIALLY_DISPATCHED`, `DISPATCHED`,
  `DELIVERED`, or `CANCELLED`. Not set for `CONFIRMED` — no action or new
  information for the customer at that step.
- Cleared (`false`) when the owning customer calls
  `GET /orders/:id` for that order (`OrdersService.getOrderDetailForUser`).
- `GET /orders` (`OrdersService.getOrdersForUser` → `PagedOrdersDto`) gets
  `hasUnseenUpdate` added to each row, so the mobile Orders tab can badge a
  total unseen count without opening every order.
- **Known limitation, accepted for this spec:** this is pull-based — the
  customer only sees the badge next time they open the app and it fetches
  `GET /orders`. There is no push. If real-time delivery is needed later,
  that's a separate spec (Expo push tokens + a sender), not part of this one.

## admin-web UI (`apps/admin-web/src/pages/OrderDetailPage.tsx`)

- **Dispatch form** (shown when `order.status === 'CONFIRMED'`): replaces the
  current carrier/tracking-only form with a checklist of the order's
  `PENDING` items, all pre-checked. Unchecking any item reveals a reason
  `<select>` (the fixed list) and a required comment `<textarea>`. Carrier +
  tracking stay required in both cases. Submit button reads "Dispatch (all
  items)" when everything's checked, or "Dispatch partially (N of M items)"
  otherwise; disabled until required fields are filled.
- **Deliver button**: shown for `DISPATCHED` or `PARTIALLY_DISPATCHED`
  (today it only shows for `DISPATCHED`), unchanged behavior otherwise.
- **Cancel form** (shown for `PLACED`/`CONFIRMED`): today's single "Cancel
  order" button becomes a reason `<select>` + required comment `<textarea>`
  ahead of the button, which stays disabled until both are filled.
- Item list gains a per-item pill (`Dispatched` / `Unavailable`) once the
  order is past `CONFIRMED`.
- Shipment card shows `reason` + `comment` when `shipment.isPartial`.
- `OrdersPage.tsx`'s `STATUS_PILL` map gets a `PARTIALLY_DISPATCHED` entry
  (its own color, distinct from `DISPATCHED`).

## Mobile UI (`apps/mobile`)

- Order detail screen: item list gains the same `Dispatched`/`Unavailable`
  pill as admin-web. The timeline already renders `OrderEvent.note` per
  status — no new client-side logic needed for the partial-dispatch message
  itself, since it's built server-side.
- Orders tab badge: `AppTabsLayout`'s `Tabs.Screen name="orders"` gains a
  `tabBarBadge`, same mechanism the Cart tab already uses
  (`apps/mobile/src/app/(app)/_layout.tsx`), driven by a count of orders with
  `hasUnseenUpdate: true` from `GET /orders`.
- Opening an order's detail screen already calls `GET /orders/:id` — that
  naturally clears the flag server-side; no extra client call needed.

## Testing

- `apps/orders/src/orders/orders.service.spec.ts`: partial-dispatch
  validation (subset selection, missing reason/comment on a partial,
  full-selection still works unchanged, stock release for items marked
  `UNAVAILABLE`); admin-cancel reason/comment validation; the new
  `PARTIALLY_DISPATCHED → DELIVERED` transition.
- `apps/orders/src/orders/admin-orders.controller.spec.ts`: new DTO shapes
  reach the service correctly.
- `scripts/e2e-happy-path.js`: append a second scenario — place → confirm →
  dispatch 2 of 3 items → assert status `PARTIALLY_DISPATCHED`, the held-back
  item's stock was released, and the shipment carries the partial
  reason/comment — then deliver → assert the customer's view shows the
  partial note and per-item pills.
- Manual: admin-web dispatch form (full vs. partial paths), cancel form,
  mobile Orders-tab badge appearing after an admin action and clearing after
  opening the order.

## Out of scope (explicitly deferred)

- Multi-batch dispatch / re-dispatching held-back items later.
- Push notifications, email, or any delivery channel beyond in-app.
- Customer-initiated cancel gaining a reason/comment requirement.
- Super admin role and per-screen admin permissions — see the separate
  `2026-09-23-admin-super-admin-permissions-design.md` spec.
