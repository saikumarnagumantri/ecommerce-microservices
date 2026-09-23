# Order Fulfillment Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin partially dispatch an order (selecting which items ship now), require a reason on both partial dispatch and admin-initiated cancellation, and give the customer an in-app (badge + timeline) signal when any of that happens.

**Architecture:** All new state lives in `apps/orders` (schema `orders`): a new `PARTIALLY_DISPATCHED` order status, a `dispatchStatus` per order item, extra columns on `shipments` for the partial reason/comment, and an `hasUnseenUpdate` flag on `orders` that the gateway-fronted REST API already surfaces through the existing `GET /orders`/`GET /orders/:id` endpoints. `admin-web` and the mobile app each get small, additive UI changes reading these new fields — no new services, no new inter-service calls.

**Tech Stack:** NestJS + TypeORM (Postgres) for `apps/orders`; React + Vite for `apps/admin-web`; Expo Router + React Native for `apps/mobile`; Jest for backend unit tests.

**Spec:** `docs/superpowers/specs/2026-09-23-order-fulfillment-overhaul-design.md`

## Global Constraints

- Dispatch stays a one-time action per order (`Shipment.orderId` stays `unique`) — items excluded from dispatch become `UNAVAILABLE` permanently, no later "dispatch the rest" action exists.
- Reason lists (`PARTIAL_DISPATCH_REASONS`, `CANCEL_REASONS`) are fixed string-literal unions, validated server-side with `class-validator`'s `@IsIn`; frontends duplicate the literal union locally (same pattern `OrderStatus` already uses) — no shared runtime package between backend and frontends.
- Reason + comment is required for admin-initiated cancel (`POST /admin/orders/:id/cancel`) and for a partial dispatch, but **not** for the existing customer self-cancel (`POST /orders/:id/cancel`), which stays exactly as it is today.
- `hasUnseenUpdate` is set on `PARTIALLY_DISPATCHED`, `DISPATCHED`, `DELIVERED`, `CANCELLED` — never on `CONFIRMED`. It is cleared **only** by the owning customer's `GET /orders/:id` (`OrdersService.getOrderDetailForUser`) — never by the admin's `GET /admin/orders/:id` (`OrdersService.adminGetDetail`).
- Notifications are in-app only for this plan — no push, no email. Out of scope, do not add.
- Money amounts stay plain integers (existing convention — no currency/decimal library).
- Migrations are raw SQL via `QueryRunner.query`, matching the two existing migrations in `apps/orders/src/migrations/` — no `synchronize: true`, ever.
- External HTTP calls (`cart.client.ts`, `inventory.client.ts`, `users.client.ts`) are mocked with `jest.mock(...)` in service tests, matching `orders.service.spec.ts`'s existing pattern — never make real HTTP calls from a unit test.

## Review Focus

- **A `dispatchedProductIds` entry that doesn't belong to the order, or isn't currently `PENDING`** (wrong id, typo, double-submit after a page reload) — must 400 with a clear message, never silently ignored or treated as if it dispatched. Covered in Task 3.
- **A partial dispatch submitted without `reason`/`comment`** (a client bug, or a direct API call bypassing the admin-web form) — must 400, never silently fall through to a full dispatch or save with nulls. Covered in Task 3.
- **An admin cancel with a reason but a blank/whitespace-only comment** — must be rejected the same as a missing comment, not accepted as "provided". Covered in Task 4.
- **`hasUnseenUpdate` clearing on the wrong read path** — an admin opening the order in admin-web (`adminGetDetail`) must never clear the flag the *customer's* mobile badge depends on; only the customer's own `GET /orders/:id` may clear it. Covered in Task 4.
- **A `PARTIALLY_DISPATCHED` order rendered by mobile's `StatusTimeline`** — the component's progress steps are a fixed `[PLACED, CONFIRMED, DISPATCHED, DELIVERED]` array; a naive `indexOf(status)` on an enum value that isn't in that array returns `-1` and silently breaks the whole progress view (nothing marked current, no step highlighted). Covered in Task 9.

---

## Task 1: Migration, entities, and constants

**Files:**
- Create: `apps/orders/src/migrations/1758610000000-AddPartialDispatchAndNotifications.ts`
- Modify: `apps/orders/src/orders/entities/order.entity.ts`
- Modify: `apps/orders/src/orders/entities/order-item.entity.ts`
- Modify: `apps/orders/src/orders/entities/shipment.entity.ts`
- Modify: `apps/orders/src/orders/constants/orders.constants.ts`

**Interfaces:**
- Produces: `OrderStatus.PARTIALLY_DISPATCHED` (enum member); `Order.hasUnseenUpdate: boolean`, `Order.cancelReason: string | null`, `Order.cancelComment: string | null`; `OrderItemDispatchStatus` enum (`PENDING` | `DISPATCHED` | `UNAVAILABLE`) and `OrderItem.dispatchStatus: OrderItemDispatchStatus`; `Shipment.isPartial: boolean`, `Shipment.reason: string | null`, `Shipment.comment: string | null`; `ALLOWED_TRANSITIONS` updated; `PARTIAL_DISPATCH_REASONS` / `PartialDispatchReason`, `CANCEL_REASONS` / `CancelReason`, `DISPATCH_REASON_REQUIRED` — all consumed by Tasks 2–4.

- [ ] **Step 1: Write the migration**

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds per-item dispatch tracking, the partial-dispatch reason/comment on
 * shipments, and the customer-facing "unseen update" flag + cancel
 * reason/comment on orders. See docs/superpowers/specs/2026-09-23-order-fulfillment-overhaul-design.md.
 */
export class AddPartialDispatchAndNotifications1758610000000 implements MigrationInterface {
  name = 'AddPartialDispatchAndNotifications1758610000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders"."order_items" ADD COLUMN "dispatchStatus" character varying(16) NOT NULL DEFAULT 'PENDING'`);
    // Backfill: items on an order that already shipped are, by definition, already dispatched.
    await queryRunner.query(`
      UPDATE "orders"."order_items"
      SET "dispatchStatus" = 'DISPATCHED'
      WHERE "orderId" IN (SELECT "id" FROM "orders"."orders" WHERE "status" IN ('DISPATCHED', 'DELIVERED'))
    `);

    await queryRunner.query(`ALTER TABLE "orders"."shipments" ADD COLUMN "isPartial" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "orders"."shipments" ADD COLUMN "reason" character varying(32)`);
    await queryRunner.query(`ALTER TABLE "orders"."shipments" ADD COLUMN "comment" text`);

    await queryRunner.query(`ALTER TABLE "orders"."orders" ADD COLUMN "hasUnseenUpdate" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "orders"."orders" ADD COLUMN "cancelReason" character varying(32)`);
    await queryRunner.query(`ALTER TABLE "orders"."orders" ADD COLUMN "cancelComment" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders"."orders" DROP COLUMN "cancelComment"`);
    await queryRunner.query(`ALTER TABLE "orders"."orders" DROP COLUMN "cancelReason"`);
    await queryRunner.query(`ALTER TABLE "orders"."orders" DROP COLUMN "hasUnseenUpdate"`);

    await queryRunner.query(`ALTER TABLE "orders"."shipments" DROP COLUMN "comment"`);
    await queryRunner.query(`ALTER TABLE "orders"."shipments" DROP COLUMN "reason"`);
    await queryRunner.query(`ALTER TABLE "orders"."shipments" DROP COLUMN "isPartial"`);

    await queryRunner.query(`ALTER TABLE "orders"."order_items" DROP COLUMN "dispatchStatus"`);
  }
}
```

- [ ] **Step 2: Update `order.entity.ts`**

Replace the file's contents with:

```ts
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum OrderStatus {
  PLACED = 'PLACED',
  CONFIRMED = 'CONFIRMED',
  DISPATCHED = 'DISPATCHED',
  PARTIALLY_DISPATCHED = 'PARTIALLY_DISPATCHED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

export enum PaymentMethod {
  COD = 'COD',
}

export interface ShippingAddressSnapshot {
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

@Entity({ name: 'orders', schema: 'orders' })
export class Order {
  @PrimaryGeneratedColumn()
  id!: number;

  // Customer/admin-facing identifiers, generated once at placement time
  // (see OrdersService.placeOrder). `id` stays the internal DB key used
  // for routing and every FK (items/events/shipment) — unchanged, to
  // avoid rearchitecting those tables — while `publicId`/`orderCode` are
  // what a customer actually sees, so a sequential integer never leaks
  // how many orders the store has taken.
  @Column({ type: 'uuid' })
  publicId!: string;

  @Column({ type: 'varchar', length: 20, unique: true })
  orderCode!: string;

  @Column({ type: 'int' })
  userId!: number;

  @Column({ type: 'varchar', length: 16, default: OrderStatus.PLACED })
  status!: OrderStatus;

  @Column({ type: 'int' })
  totalAmount!: number;

  @Column({ type: 'jsonb' })
  shippingAddress!: ShippingAddressSnapshot;

  @Column({ type: 'varchar', length: 16, default: PaymentMethod.COD })
  paymentMethod!: PaymentMethod;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  /** True after an admin action the customer hasn't seen yet (dispatch, partial dispatch, deliver, cancel). Cleared only by the owning customer opening this order's detail — never by an admin viewing it. */
  @Column({ type: 'boolean', default: false })
  hasUnseenUpdate!: boolean;

  @Column({ type: 'varchar', length: 32, nullable: true })
  cancelReason!: string | null;

  @Column({ type: 'text', nullable: true })
  cancelComment!: string | null;
}
```

- [ ] **Step 3: Update `order-item.entity.ts`**

Replace the file's contents with:

```ts
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum OrderItemDispatchStatus {
  PENDING = 'PENDING',
  DISPATCHED = 'DISPATCHED',
  UNAVAILABLE = 'UNAVAILABLE',
}

/** A price/name snapshot at order time — never re-reads products, so history is stable even if a product later changes or is deactivated. */
@Entity({ name: 'order_items', schema: 'orders' })
export class OrderItem {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  orderId!: number;

  @Column({ type: 'int' })
  productId!: number;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'int' })
  price!: number;

  @Column({ type: 'int' })
  quantity!: number;

  /** PENDING until the order is dispatched, then DISPATCHED (shipped) or UNAVAILABLE (held back — see Shipment.isPartial/reason/comment for why). Terminal once set to DISPATCHED or UNAVAILABLE — dispatch happens at most once per order. */
  @Column({ type: 'varchar', length: 16, default: OrderItemDispatchStatus.PENDING })
  dispatchStatus!: OrderItemDispatchStatus;
}
```

- [ ] **Step 4: Update `shipment.entity.ts`**

Replace the file's contents with:

```ts
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'shipments', schema: 'orders' })
export class Shipment {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int', unique: true })
  orderId!: number;

  @Column({ type: 'varchar', length: 128 })
  carrier!: string;

  @Column({ type: 'varchar', length: 128 })
  trackingNumber!: string;

  @Column({ type: 'timestamptz' })
  dispatchedAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  deliveredAt!: Date | null;

  /** True when at least one of the order's items was held back from this dispatch. */
  @Column({ type: 'boolean', default: false })
  isPartial!: boolean;

  @Column({ type: 'varchar', length: 32, nullable: true })
  reason!: string | null;

  @Column({ type: 'text', nullable: true })
  comment!: string | null;
}
```

- [ ] **Step 5: Update `orders.constants.ts`**

Replace the file's contents with:

```ts
export const CART_EMPTY = 'Cannot place an order from an empty cart';
export const ORDER_NOT_FOUND = 'Order not found';
export const CANNOT_CANCEL = 'Only a placed or confirmed order can be cancelled';
export const DISPATCH_REASON_REQUIRED = 'A reason and comment are required when holding back any item from dispatch';

/** The only transitions an admin (or the cancel flow) may make. Anything else is a 409. */
export const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  PLACED: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['DISPATCHED', 'PARTIALLY_DISPATCHED', 'CANCELLED'],
  DISPATCHED: ['DELIVERED'],
  PARTIALLY_DISPATCHED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

/** Why some items were held back from a dispatch. Validated with class-validator's @IsIn — see DispatchOrderDto. */
export const PARTIAL_DISPATCH_REASONS = ['OUT_OF_STOCK', 'ITEM_DAMAGED', 'ITEM_DISCONTINUED', 'COURIER_LIMIT', 'OTHER'] as const;
export type PartialDispatchReason = (typeof PARTIAL_DISPATCH_REASONS)[number];

/** Why an admin cancelled an order. Validated with class-validator's @IsIn — see CancelOrderDto. */
export const CANCEL_REASONS = ['CUSTOMER_REQUESTED', 'OUT_OF_STOCK', 'DUPLICATE_ORDER', 'SUSPECTED_FRAUD', 'UNDELIVERABLE_ADDRESS', 'OTHER'] as const;
export type CancelReason = (typeof CANCEL_REASONS)[number];
```

- [ ] **Step 6: Run the migration**

Postgres must be reachable (`npm run start:infra` from the repo root if it isn't already up).

Run: `cd apps/orders && npm run migration:run`
Expected: output lists `AddPartialDispatchAndNotifications1758610000000` as executed, no errors.

- [ ] **Step 7: Commit**

```bash
git add apps/orders/src/migrations/1758610000000-AddPartialDispatchAndNotifications.ts apps/orders/src/orders/entities/order.entity.ts apps/orders/src/orders/entities/order-item.entity.ts apps/orders/src/orders/entities/shipment.entity.ts apps/orders/src/orders/constants/orders.constants.ts
git commit -m "orders: add PARTIALLY_DISPATCHED status, per-item dispatch tracking, and notification/cancel-reason columns"
```

---

## Task 2: DTOs

**Files:**
- Modify: `apps/orders/src/orders/dto/dispatch.dto.ts`
- Create: `apps/orders/src/orders/dto/cancel-order.dto.ts`
- Modify: `apps/orders/src/orders/dto/order-response.dto.ts`

**Interfaces:**
- Consumes: `OrderItemDispatchStatus` (Task 1, `entities/order-item.entity.ts`), `PARTIAL_DISPATCH_REASONS`/`PartialDispatchReason`, `CANCEL_REASONS`/`CancelReason` (Task 1, `constants/orders.constants.ts`).
- Produces: `DispatchOrderDto { carrier, trackingNumber, dispatchedProductIds: number[], reason?: PartialDispatchReason, comment?: string }`; `CancelOrderDto { reason: CancelReason, comment: string }`; `OrderItemResponseDto.dispatchStatus`, `ShipmentResponseDto.isPartial/reason/comment`, `OrderSummaryDto.hasUnseenUpdate` — all consumed by Task 3, 4, and the controllers.

- [ ] **Step 1: Update `dispatch.dto.ts`**

Replace the file's contents with:

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMinSize, ArrayUnique, IsArray, IsIn, IsInt, IsOptional, IsString, MinLength } from 'class-validator';
import { PARTIAL_DISPATCH_REASONS, PartialDispatchReason } from '../constants/orders.constants';

export class DispatchOrderDto {
  @ApiProperty({ example: 'BlueDart' })
  @IsString()
  @MinLength(1)
  carrier!: string;

  @ApiProperty({ example: 'BD48217730IN' })
  @IsString()
  @MinLength(1)
  trackingNumber!: string;

  @ApiProperty({
    type: [Number],
    example: [101, 102],
    description: "Product ids from this order's PENDING items to dispatch now. Any pending item not listed becomes UNAVAILABLE.",
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsInt({ each: true })
  dispatchedProductIds!: number[];

  @ApiPropertyOptional({ enum: PARTIAL_DISPATCH_REASONS, description: "Required when dispatchedProductIds is a proper subset of the order's pending items." })
  @IsOptional()
  @IsIn(PARTIAL_DISPATCH_REASONS)
  reason?: PartialDispatchReason;

  @ApiPropertyOptional({ description: 'Required whenever reason is required.' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  comment?: string;
}
```

- [ ] **Step 2: Create `cancel-order.dto.ts`**

```ts
import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, MinLength } from 'class-validator';
import { CANCEL_REASONS, CancelReason } from '../constants/orders.constants';

export class CancelOrderDto {
  @ApiProperty({ enum: CANCEL_REASONS })
  @IsIn(CANCEL_REASONS)
  reason!: CancelReason;

  @ApiProperty({ example: 'Customer called asking to cancel.' })
  @IsString()
  @MinLength(1)
  comment!: string;
}
```

- [ ] **Step 3: Update `order-response.dto.ts`**

Replace the file's contents with:

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus, PaymentMethod } from '../entities/order.entity';
import type { ShippingAddressSnapshot } from '../entities/order.entity';
import { OrderItemDispatchStatus } from '../entities/order-item.entity';

export class OrderItemResponseDto {
  @ApiProperty({ example: 101 })
  productId!: number;

  @ApiProperty({ example: 'UltraBook Pro 15' })
  name!: string;

  @ApiProperty({ example: 1350 })
  price!: number;

  @ApiProperty({ example: 1 })
  quantity!: number;

  @ApiProperty({ enum: OrderItemDispatchStatus })
  dispatchStatus!: OrderItemDispatchStatus;
}

export class OrderEventResponseDto {
  @ApiProperty({ enum: OrderStatus })
  status!: OrderStatus;

  @ApiPropertyOptional({ nullable: true })
  note!: string | null;

  @ApiProperty()
  createdAt!: Date;
}

export class ShipmentResponseDto {
  @ApiProperty({ example: 'BlueDart' })
  carrier!: string;

  @ApiProperty({ example: 'BD48217730IN' })
  trackingNumber!: string;

  @ApiProperty()
  dispatchedAt!: Date;

  @ApiPropertyOptional({ nullable: true })
  deliveredAt!: Date | null;

  @ApiProperty({ example: false })
  isPartial!: boolean;

  @ApiPropertyOptional({ nullable: true, example: 'OUT_OF_STOCK' })
  reason!: string | null;

  @ApiPropertyOptional({ nullable: true })
  comment!: string | null;
}

export class OrderSummaryDto {
  @ApiProperty({ example: 1042 })
  id!: number;

  @ApiProperty({ example: 'b3f1c2a4-9d3e-4f1a-8b2c-1234567890ab', description: 'Stable public identifier for this order.' })
  publicId!: string;

  @ApiProperty({ example: 'SC-4F2A9E11', description: 'Short human-readable order code, shown to the customer.' })
  orderCode!: string;

  @ApiProperty({ example: 2 })
  userId!: number;

  @ApiProperty({ enum: OrderStatus })
  status!: OrderStatus;

  @ApiProperty({ example: 1749 })
  totalAmount!: number;

  @ApiProperty({ enum: PaymentMethod })
  paymentMethod!: PaymentMethod;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty({ example: false, description: "True when this order has an admin-triggered update the customer hasn't seen yet." })
  hasUnseenUpdate!: boolean;
}

export class OrderDetailDto extends OrderSummaryDto {
  @ApiProperty({ type: [OrderItemResponseDto] })
  items!: OrderItemResponseDto[];

  @ApiProperty()
  shippingAddress!: ShippingAddressSnapshot;

  @ApiProperty({ type: [OrderEventResponseDto] })
  events!: OrderEventResponseDto[];

  @ApiPropertyOptional({ type: ShipmentResponseDto, nullable: true })
  shipment!: ShipmentResponseDto | null;
}

export class BulkConfirmFailureDto {
  @ApiProperty({ example: 1042 })
  orderId!: number;

  @ApiProperty({ example: 'Cannot move an order from CANCELLED to CONFIRMED' })
  error!: string;
}

export class BulkConfirmResultDto {
  @ApiProperty({ type: [Number], example: [1042, 1043] })
  confirmed!: number[];

  @ApiProperty({ type: [BulkConfirmFailureDto] })
  failed!: BulkConfirmFailureDto[];
}

export class PagedOrdersDto {
  @ApiProperty({ type: [OrderSummaryDto] })
  data!: OrderSummaryDto[];

  @ApiProperty({ example: 42 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 3 })
  totalPages!: number;
}
```

- [ ] **Step 4: Typecheck**

Run: `cd apps/orders && npx tsc --noEmit`
Expected: fails right now (Task 3 hasn't updated `orders.service.ts` to match these new types yet) — that's expected at this point in the plan. Confirm the *only* errors are in `orders.service.ts` (missing `dispatchStatus`/`hasUnseenUpdate`/`isPartial` etc. on object literals it builds) — if there are errors anywhere else, stop and fix this task first.

- [ ] **Step 5: Commit**

```bash
git add apps/orders/src/orders/dto/dispatch.dto.ts apps/orders/src/orders/dto/cancel-order.dto.ts apps/orders/src/orders/dto/order-response.dto.ts
git commit -m "orders: add partial-dispatch and cancel-reason DTOs, extend response DTOs"
```

---

## Task 3: `OrdersService.dispatch()` — partial dispatch logic + tests

**Files:**
- Modify: `apps/orders/src/orders/orders.service.ts`
- Modify: `apps/orders/src/orders/orders.service.spec.ts`

**Interfaces:**
- Consumes: `DispatchOrderDto`, `OrderItemDispatchStatus`, `DISPATCH_REASON_REQUIRED` (Tasks 1–2).
- Produces: `OrdersService.dispatch(orderId: number, dto: DispatchOrderDto, adminId: number): Promise<OrderDetailDto>` — same signature as today, new body. Consumed by `admin-orders.controller.ts` (already wired, no controller change needed for this method) and Task 6's e2e script.

- [ ] **Step 1: Write the failing tests**

In `apps/orders/src/orders/orders.service.spec.ts`, add these imports at the top (alongside the existing ones):

```ts
import { OrderItemDispatchStatus } from './entities/order-item.entity';
```

Replace the entire `describe('state machine', ...)` block with:

```ts
  describe('state machine', () => {
    it('rejects confirming an order that is not PLACED', async () => {
      orderRepo.findOneBy!.mockResolvedValue({ id: 1, status: OrderStatus.DISPATCHED } as Order);
      const { dataSource } = fakeDataSource();
      const service = await buildService(dataSource);

      await expect(service.confirm(1, 99)).rejects.toThrow(ConflictException);
    });

    it('allows PLACED -> CONFIRMED', async () => {
      orderRepo.findOneBy!.mockResolvedValue({ id: 1, status: OrderStatus.PLACED } as Order);
      const { dataSource } = fakeDataSource();
      const service = await buildService(dataSource);

      const result = await service.confirm(1, 99);
      expect(result.status).toBe(OrderStatus.CONFIRMED);
      expect(eventRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ orderId: 1, status: OrderStatus.CONFIRMED, actorId: 99 }),
      );
    });
  });

  describe('dispatch', () => {
    const twoPendingItems = [
      { id: 1, orderId: 1, productId: 101, name: 'Laptop', price: 1000, quantity: 1, dispatchStatus: OrderItemDispatchStatus.PENDING },
      { id: 2, orderId: 1, productId: 102, name: 'Mouse', price: 20, quantity: 2, dispatchStatus: OrderItemDispatchStatus.PENDING },
    ];

    beforeEach(() => {
      itemRepo.findBy!.mockResolvedValue(twoPendingItems);
    });

    it('rejects dispatch on a PLACED (not yet confirmed) order', async () => {
      orderRepo.findOneBy!.mockResolvedValue({ id: 1, status: OrderStatus.PLACED } as Order);
      const { dataSource } = fakeDataSource();
      const service = await buildService(dataSource);

      await expect(
        service.dispatch(1, { carrier: 'BlueDart', trackingNumber: 'ABC123', dispatchedProductIds: [101, 102] }, 99),
      ).rejects.toThrow(ConflictException);
    });

    it('dispatching every pending item creates a non-partial shipment and moves CONFIRMED -> DISPATCHED', async () => {
      orderRepo.findOneBy!.mockResolvedValue({ id: 1, status: OrderStatus.CONFIRMED } as Order);
      const { dataSource } = fakeDataSource();
      const service = await buildService(dataSource);

      const result = await service.dispatch(1, { carrier: 'BlueDart', trackingNumber: 'ABC123', dispatchedProductIds: [101, 102] }, 99);

      expect(result.status).toBe(OrderStatus.DISPATCHED);
      expect(shipmentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ orderId: 1, carrier: 'BlueDart', trackingNumber: 'ABC123', isPartial: false, reason: null, comment: null }),
      );
      expect(itemRepo.save).toHaveBeenCalledWith([
        { ...twoPendingItems[0], dispatchStatus: OrderItemDispatchStatus.DISPATCHED },
        { ...twoPendingItems[1], dispatchStatus: OrderItemDispatchStatus.DISPATCHED },
      ]);
      expect(inventoryClient.releaseStock).not.toHaveBeenCalled();
    });

    it('rejects a partial selection with no reason or comment', async () => {
      orderRepo.findOneBy!.mockResolvedValue({ id: 1, status: OrderStatus.CONFIRMED } as Order);
      const { dataSource } = fakeDataSource();
      const service = await buildService(dataSource);

      await expect(
        service.dispatch(1, { carrier: 'BlueDart', trackingNumber: 'ABC123', dispatchedProductIds: [101] }, 99),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts a partial dispatch with reason and comment, releases stock for held-back items, moves to PARTIALLY_DISPATCHED', async () => {
      orderRepo.findOneBy!.mockResolvedValue({ id: 1, status: OrderStatus.CONFIRMED } as Order);
      const { dataSource } = fakeDataSource();
      const service = await buildService(dataSource);

      const result = await service.dispatch(
        1,
        { carrier: 'BlueDart', trackingNumber: 'ABC123', dispatchedProductIds: [101], reason: 'OUT_OF_STOCK', comment: 'Only 1 left' },
        99,
      );

      expect(result.status).toBe(OrderStatus.PARTIALLY_DISPATCHED);
      expect(shipmentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ isPartial: true, reason: 'OUT_OF_STOCK', comment: 'Only 1 left' }),
      );
      expect(itemRepo.save).toHaveBeenCalledWith([
        { ...twoPendingItems[0], dispatchStatus: OrderItemDispatchStatus.DISPATCHED },
        { ...twoPendingItems[1], dispatchStatus: OrderItemDispatchStatus.UNAVAILABLE },
      ]);
      expect(inventoryClient.releaseStock).toHaveBeenCalledWith({
        items: { 102: { quantity: 2 } },
        refId: '1',
      });
    });

    it('rejects dispatching a product id that is not part of the order', async () => {
      orderRepo.findOneBy!.mockResolvedValue({ id: 1, status: OrderStatus.CONFIRMED } as Order);
      const { dataSource } = fakeDataSource();
      const service = await buildService(dataSource);

      await expect(
        service.dispatch(1, { carrier: 'BlueDart', trackingNumber: 'ABC123', dispatchedProductIds: [999] }, 99),
      ).rejects.toThrow(BadRequestException);
    });
  });
```

Also update the `beforeEach` a few lines above (it currently defines `itemRepo` without a `save` mock) — change:

```ts
    itemRepo = { findBy: jest.fn().mockResolvedValue([]) };
```

to:

```ts
    itemRepo = { findBy: jest.fn().mockResolvedValue([]), save: jest.fn() };
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/orders && npx jest orders.service.spec.ts -t dispatch`
Expected: FAIL — `dto.dispatchedProductIds` doesn't exist on the old DTO usage path / `dispatch` doesn't yet read `itemRepo.findBy` or write `itemRepo.save`, and `OrderStatus.PARTIALLY_DISPATCHED` isn't reached yet.

- [ ] **Step 3: Implement `dispatch()`**

In `apps/orders/src/orders/orders.service.ts`, replace the existing constants import line:

```ts
import { ALLOWED_TRANSITIONS, CANNOT_CANCEL, CART_EMPTY, ORDER_NOT_FOUND } from './constants/orders.constants';
```

with:

```ts
import { ALLOWED_TRANSITIONS, CANNOT_CANCEL, CART_EMPTY, DISPATCH_REASON_REQUIRED, ORDER_NOT_FOUND } from './constants/orders.constants';
```

Add this import alongside the other entity imports:

```ts
import { OrderItemDispatchStatus } from './entities/order-item.entity';
```

Replace the existing `dispatch` method with:

```ts
  async dispatch(orderId: number, dto: DispatchOrderDto, adminId: number): Promise<OrderDetailDto> {
    const order = await this.findOrThrow(orderId);
    if (order.status !== OrderStatus.CONFIRMED) {
      throw new ConflictException(`Cannot move an order from ${order.status} to ${OrderStatus.DISPATCHED}`);
    }

    const items = await this.itemRepo.findBy({ orderId: order.id });
    const pending = items.filter((i) => i.dispatchStatus === OrderItemDispatchStatus.PENDING);
    const pendingIds = new Set(pending.map((i) => i.productId));
    const selected = new Set(dto.dispatchedProductIds);

    const invalid = dto.dispatchedProductIds.filter((id) => !pendingIds.has(id));
    if (invalid.length > 0) {
      throw new BadRequestException(`These items are not eligible to dispatch: ${invalid.join(', ')}`);
    }

    const isPartial = selected.size < pending.length;
    if (isPartial && (!dto.reason || !dto.comment)) {
      throw new BadRequestException(DISPATCH_REASON_REQUIRED);
    }

    const heldBackItems = pending.filter((i) => !selected.has(i.productId));
    const note = isPartial
      ? `Partially dispatched: ${selected.size} of ${pending.length} items shipped via ${dto.carrier} (${dto.trackingNumber}). ${heldBackItems.length} item(s) unavailable — ${dto.reason}: ${dto.comment}`
      : `Dispatched via ${dto.carrier} (${dto.trackingNumber})`;

    return this.transition(order, isPartial ? OrderStatus.PARTIALLY_DISPATCHED : OrderStatus.DISPATCHED, adminId, note, async () => {
      await this.itemRepo.save(
        pending.map((i) => ({
          ...i,
          dispatchStatus: selected.has(i.productId) ? OrderItemDispatchStatus.DISPATCHED : OrderItemDispatchStatus.UNAVAILABLE,
        })),
      );

      if (heldBackItems.length > 0) {
        await releaseStock({
          items: Object.fromEntries(heldBackItems.map((i) => [i.productId, { quantity: i.quantity }])),
          refId: String(order.id),
        });
      }

      await this.shipmentRepo.save({
        orderId: order.id,
        carrier: dto.carrier,
        trackingNumber: dto.trackingNumber,
        dispatchedAt: new Date(),
        deliveredAt: null,
        isPartial,
        reason: isPartial ? (dto.reason ?? null) : null,
        comment: isPartial ? (dto.comment ?? null) : null,
      });
    });
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/orders && npx jest orders.service.spec.ts -t dispatch`
Expected: PASS (all 5 tests in the `dispatch` describe block).

- [ ] **Step 5: Commit**

```bash
git add apps/orders/src/orders/orders.service.ts apps/orders/src/orders/orders.service.spec.ts
git commit -m "orders: implement partial dispatch with per-item tracking and stock release"
```

---

## Task 4: `adminCancel()` reason/comment, `hasUnseenUpdate`, and controller wiring

**Files:**
- Modify: `apps/orders/src/orders/orders.service.ts`
- Modify: `apps/orders/src/orders/orders.service.spec.ts`
- Modify: `apps/orders/src/orders/admin-orders.controller.ts`
- Modify: `apps/orders/src/orders/admin-orders.controller.spec.ts`

**Interfaces:**
- Consumes: `CancelOrderDto` (Task 2).
- Produces: `OrdersService.adminCancel(orderId: number, adminId: number, dto: CancelOrderDto): Promise<OrderDetailDto>` (signature change — was `(orderId, adminId)`); `Order.hasUnseenUpdate` set inside `transition()`, cleared inside `getOrderDetailForUser()`. Consumed by `admin-orders.controller.ts` (this task) and Task 6's e2e script.

- [ ] **Step 1: Write the failing tests**

In `apps/orders/src/orders/orders.service.spec.ts`, add these two `describe` blocks right after the `dispatch` block (before `cancelForUser`):

```ts
  describe('adminCancel', () => {
    it('requires a reason and comment, releases stock, and records them on the order', async () => {
      orderRepo.findOneBy!.mockResolvedValue({ id: 1, status: OrderStatus.PLACED } as Order);
      itemRepo.findBy!.mockResolvedValue([{ productId: 101, quantity: 3 }]);
      const { dataSource } = fakeDataSource();
      const service = await buildService(dataSource);

      const result = await service.adminCancel(1, 99, { reason: 'OUT_OF_STOCK', comment: 'No stock left' });

      expect(result.status).toBe(OrderStatus.CANCELLED);
      expect(inventoryClient.releaseStock).toHaveBeenCalledWith({
        items: { 101: { quantity: 3 } },
        refId: '1',
      });
      expect(orderRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ cancelReason: 'OUT_OF_STOCK', cancelComment: 'No stock left' }),
      );
    });

    it('rejects cancelling a DISPATCHED order', async () => {
      orderRepo.findOneBy!.mockResolvedValue({ id: 1, status: OrderStatus.DISPATCHED } as Order);
      const { dataSource } = fakeDataSource();
      const service = await buildService(dataSource);

      await expect(
        service.adminCancel(1, 99, { reason: 'OUT_OF_STOCK', comment: 'No stock left' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('hasUnseenUpdate', () => {
    it('flags the order unseen when an admin dispatches it', async () => {
      orderRepo.findOneBy!.mockResolvedValue({ id: 1, status: OrderStatus.CONFIRMED } as Order);
      itemRepo.findBy!.mockResolvedValue([
        { id: 1, orderId: 1, productId: 101, name: 'Laptop', price: 1000, quantity: 1, dispatchStatus: OrderItemDispatchStatus.PENDING },
      ]);
      const { dataSource } = fakeDataSource();
      const service = await buildService(dataSource);

      await service.dispatch(1, { carrier: 'BlueDart', trackingNumber: 'ABC123', dispatchedProductIds: [101] }, 99);

      expect(orderRepo.save).toHaveBeenCalledWith(expect.objectContaining({ hasUnseenUpdate: true }));
    });

    it('does not flag the order when an admin merely confirms it', async () => {
      orderRepo.findOneBy!.mockResolvedValue({ id: 1, status: OrderStatus.PLACED } as Order);
      const { dataSource } = fakeDataSource();
      const service = await buildService(dataSource);

      await service.confirm(1, 99);

      expect(orderRepo.save).toHaveBeenCalledWith(expect.not.objectContaining({ hasUnseenUpdate: true }));
    });

    it('clears the flag when the owning customer opens the order, but an admin viewing it leaves the flag alone', async () => {
      const order = { id: 1, userId: 1, status: OrderStatus.DISPATCHED, hasUnseenUpdate: true } as Order;
      orderRepo.findOneBy!.mockResolvedValue(order);
      const { dataSource } = fakeDataSource();
      const service = await buildService(dataSource);

      await service.getOrderDetailForUser(1, 1);
      expect(orderRepo.save).toHaveBeenCalledWith(expect.objectContaining({ hasUnseenUpdate: false }));

      (orderRepo.save as jest.Mock).mockClear();
      await service.adminGetDetail(1);
      expect(orderRepo.save).not.toHaveBeenCalled();
    });
  });
```

Also replace the entire contents of `apps/orders/src/orders/admin-orders.controller.spec.ts` with:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { AdminOrdersController } from './admin-orders.controller';
import { OrdersService } from './orders.service';

describe('AdminOrdersController', () => {
  let controller: AdminOrdersController;
  let service: {
    adminList: jest.Mock;
    adminGetDetail: jest.Mock;
    confirm: jest.Mock;
    dispatch: jest.Mock;
    deliver: jest.Mock;
    adminCancel: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      adminList: jest.fn(),
      adminGetDetail: jest.fn(),
      confirm: jest.fn(),
      dispatch: jest.fn(),
      deliver: jest.fn(),
      adminCancel: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminOrdersController],
      providers: [{ provide: OrdersService, useValue: service }],
    }).compile();

    controller = module.get<AdminOrdersController>(AdminOrdersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('cancel forwards the order id, the admin id, and the reason/comment dto to adminCancel', async () => {
    const dto = { reason: 'OUT_OF_STOCK' as const, comment: 'No stock left' };

    await controller.cancel(1, dto, { id: 99 } as any);

    expect(service.adminCancel).toHaveBeenCalledWith(1, 99, dto);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/orders && npx jest orders.service.spec.ts admin-orders.controller.spec.ts -t "adminCancel|hasUnseenUpdate|cancel forwards"`
Expected: FAIL — `adminCancel` doesn't accept a third `dto` argument yet, `transition()` doesn't set `hasUnseenUpdate`, `getOrderDetailForUser()` doesn't clear it, and `AdminOrdersController.cancel` doesn't yet take a `dto` parameter.

- [ ] **Step 3: Implement the changes**

In `apps/orders/src/orders/orders.service.ts` (the constants import was already updated in Task 3 to include `DISPATCH_REASON_REQUIRED` — no further change needed there), add this import alongside the other DTO imports:

```ts
import { CancelOrderDto } from './dto/cancel-order.dto';
```

Replace `getOrderDetailForUser`:

```ts
  async getOrderDetailForUser(userId: number, orderId: number): Promise<OrderDetailDto> {
    const order = await this.orderRepo.findOneBy({ id: orderId, userId });
    if (!order) throw new NotFoundException(ORDER_NOT_FOUND);
    if (order.hasUnseenUpdate) {
      order.hasUnseenUpdate = false;
      await this.orderRepo.save(order);
    }
    return this.toDetail(order);
  }
```

Replace `adminCancel`:

```ts
  async adminCancel(orderId: number, adminId: number, dto: CancelOrderDto): Promise<OrderDetailDto> {
    const order = await this.findOrThrow(orderId);
    if (!['PLACED', 'CONFIRMED'].includes(order.status)) {
      throw new ConflictException(CANNOT_CANCEL);
    }
    return this.transition(order, OrderStatus.CANCELLED, adminId, `Cancelled by admin — ${dto.reason}: ${dto.comment}`, async () => {
      order.cancelReason = dto.reason;
      order.cancelComment = dto.comment;
      const items = await this.itemRepo.findBy({ orderId: order.id });
      await releaseStock({
        items: Object.fromEntries(items.map((i) => [i.productId, { quantity: i.quantity }])),
        refId: String(order.id),
      });
    });
  }
```

Replace `transition`:

```ts
  private async transition(
    order: Order,
    target: OrderStatus,
    actorId: number,
    note: string,
    sideEffect?: () => Promise<void>,
  ): Promise<OrderDetailDto> {
    const allowed = ALLOWED_TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(target)) {
      throw new ConflictException(`Cannot move an order from ${order.status} to ${target}`);
    }

    if (sideEffect) await sideEffect();

    order.status = target;
    if (
      [OrderStatus.PARTIALLY_DISPATCHED, OrderStatus.DISPATCHED, OrderStatus.DELIVERED, OrderStatus.CANCELLED].includes(target)
    ) {
      order.hasUnseenUpdate = true;
    }
    await this.orderRepo.save(order);
    await this.eventRepo.save({ orderId: order.id, status: target, note, actorId });

    return this.toDetail(order);
  }
```

Replace the row mapping inside `pagedList` (the object built per row in `rows.map(...)`) — add `hasUnseenUpdate: o.hasUnseenUpdate,` right after `createdAt: o.createdAt,`:

```ts
      data: rows.map((o) => ({
        id: o.id,
        publicId: o.publicId,
        orderCode: o.orderCode,
        userId: o.userId,
        status: o.status,
        totalAmount: o.totalAmount,
        paymentMethod: o.paymentMethod,
        createdAt: o.createdAt,
        hasUnseenUpdate: o.hasUnseenUpdate,
      })),
```

Replace `toDetail`:

```ts
  private async toDetail(order: Order): Promise<OrderDetailDto> {
    const [items, events, shipment] = await Promise.all([
      this.itemRepo.findBy({ orderId: order.id }),
      this.eventRepo.find({ where: { orderId: order.id }, order: { createdAt: 'ASC' } }),
      this.shipmentRepo.findOneBy({ orderId: order.id }),
    ]);

    return {
      id: order.id,
      publicId: order.publicId,
      orderCode: order.orderCode,
      userId: order.userId,
      status: order.status,
      totalAmount: order.totalAmount,
      paymentMethod: order.paymentMethod,
      createdAt: order.createdAt,
      hasUnseenUpdate: order.hasUnseenUpdate,
      shippingAddress: order.shippingAddress,
      items: items.map((i) => ({ productId: i.productId, name: i.name, price: i.price, quantity: i.quantity, dispatchStatus: i.dispatchStatus })),
      events: events.map((e) => ({ status: e.status, note: e.note, createdAt: e.createdAt })),
      shipment: shipment
        ? {
            carrier: shipment.carrier,
            trackingNumber: shipment.trackingNumber,
            dispatchedAt: shipment.dispatchedAt,
            deliveredAt: shipment.deliveredAt,
            isPartial: shipment.isPartial,
            reason: shipment.reason,
            comment: shipment.comment,
          }
        : null,
    };
  }
```

Now wire the controller. In `apps/orders/src/orders/admin-orders.controller.ts`, add the import:

```ts
import { CancelOrderDto } from './dto/cancel-order.dto';
```

Replace the `cancel` method:

```ts
  @Post(':id/cancel')
  @ApiOkResponse({ type: OrderDetailDto })
  cancel(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelOrderDto,
    @CurrentUser() admin: AuthenticatedUser,
  ): Promise<OrderDetailDto> {
    return this.ordersService.adminCancel(id, admin.id, dto);
  }
```

(`Body` is already imported in this file from `@nestjs/common` for the `confirmBulk` and `dispatch` methods — no new import needed there.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/orders && npx jest orders.service.spec.ts admin-orders.controller.spec.ts`
Expected: PASS — every test in both files, including `placeOrder`, `state machine`, `dispatch`, `adminCancel`, `hasUnseenUpdate`, `cancelForUser`, and the controller's `cancel forwards...` test.

- [ ] **Step 5: Full backend typecheck**

Run: `cd apps/orders && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/orders/src/orders/orders.service.ts apps/orders/src/orders/orders.service.spec.ts apps/orders/src/orders/admin-orders.controller.ts apps/orders/src/orders/admin-orders.controller.spec.ts
git commit -m "orders: require reason+comment on admin cancel, add hasUnseenUpdate notification flag"
```

---

## Task 5: `e2e-happy-path.js` — partial dispatch scenario

**Files:**
- Modify: `scripts/e2e-happy-path.js`

**Interfaces:**
- Consumes: `POST /admin/orders/:id/dispatch` with `dispatchedProductIds`/`reason`/`comment`, `POST /admin/orders/:id/cancel` with `reason`/`comment` (Tasks 3–4, over HTTP through the gateway).

- [ ] **Step 1: Add the scenario**

This script has no test framework — its own `assert()` helper is the check. Add a new scenario after the existing happy-path steps (after the `console.log('\nPASS — ...')` line's preceding step, i.e. insert this block **before** the final `console.log(...)` and keep that `console.log` as the very last thing `main()` does):

```js
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

  const customerView2 = await call('GET', `/orders/${order2.id}`, undefined, customer2Token);
  assert(customerView2.hasUnseenUpdate === false, "opening the order cleared the customer's unseen flag");
```

- [ ] **Step 2: Run it against the live stack**

Requires the full stack up (`npm run start:infra` + `npm run start:all` from the repo root, and an admin seeded per `apps/users/.env` — see README).

Run: `node scripts/e2e-happy-path.js`
Expected: `PASS` at the end, with every `ok —` line printed for both scenarios and no `FAIL`.

- [ ] **Step 3: Commit**

```bash
git add scripts/e2e-happy-path.js
git commit -m "e2e: cover partial dispatch, per-item status, and the customer unseen-update flag"
```

---

## Task 6: admin-web — types and API client

**Files:**
- Modify: `apps/admin-web/src/api/types.ts`
- Modify: `apps/admin-web/src/api/orders.ts`

**Interfaces:**
- Produces: `OrderStatus` gains `'PARTIALLY_DISPATCHED'`; `ItemDispatchStatus`, `PartialDispatchReason`, `CancelReason` types; `OrderItem.dispatchStatus`, `Shipment.isPartial/reason/comment`, `OrderSummary.hasUnseenUpdate`; `ordersApi.dispatchOrder(id, carrier, trackingNumber, dispatchedProductIds, reason?, comment?)`, `ordersApi.cancelOrder(id, reason, comment)` — both signature changes, consumed by Task 7.

- [ ] **Step 1: Update `types.ts`**

In `apps/admin-web/src/api/types.ts`, replace:

```ts
export type OrderStatus = 'PLACED' | 'CONFIRMED' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED';

export interface OrderItem {
  productId: number;
  name: string;
  price: number;
  quantity: number;
}

export interface OrderEvent {
  status: OrderStatus;
  note: string | null;
  createdAt: string;
}

export interface Shipment {
  carrier: string;
  trackingNumber: string;
  dispatchedAt: string;
  deliveredAt: string | null;
}

export interface OrderSummary {
  id: number;
  publicId: string;
  orderCode: string;
  userId: number;
  status: OrderStatus;
  totalAmount: number;
  paymentMethod: 'COD';
  createdAt: string;
}
```

with:

```ts
export type OrderStatus = 'PLACED' | 'CONFIRMED' | 'DISPATCHED' | 'PARTIALLY_DISPATCHED' | 'DELIVERED' | 'CANCELLED';
export type ItemDispatchStatus = 'PENDING' | 'DISPATCHED' | 'UNAVAILABLE';
export type PartialDispatchReason = 'OUT_OF_STOCK' | 'ITEM_DAMAGED' | 'ITEM_DISCONTINUED' | 'COURIER_LIMIT' | 'OTHER';
export type CancelReason = 'CUSTOMER_REQUESTED' | 'OUT_OF_STOCK' | 'DUPLICATE_ORDER' | 'SUSPECTED_FRAUD' | 'UNDELIVERABLE_ADDRESS' | 'OTHER';

export interface OrderItem {
  productId: number;
  name: string;
  price: number;
  quantity: number;
  dispatchStatus: ItemDispatchStatus;
}

export interface OrderEvent {
  status: OrderStatus;
  note: string | null;
  createdAt: string;
}

export interface Shipment {
  carrier: string;
  trackingNumber: string;
  dispatchedAt: string;
  deliveredAt: string | null;
  isPartial: boolean;
  reason: string | null;
  comment: string | null;
}

export interface OrderSummary {
  id: number;
  publicId: string;
  orderCode: string;
  userId: number;
  status: OrderStatus;
  totalAmount: number;
  paymentMethod: 'COD';
  createdAt: string;
  hasUnseenUpdate: boolean;
}
```

- [ ] **Step 2: Update `orders.ts`**

Replace `dispatchOrder` and `cancelOrder`:

```ts
export const dispatchOrder = (
  id: number,
  carrier: string,
  trackingNumber: string,
  dispatchedProductIds: number[],
  reason?: PartialDispatchReason,
  comment?: string,
): Promise<OrderDetail> =>
  apiClient.post(`/admin/orders/${id}/dispatch`, { carrier, trackingNumber, dispatchedProductIds, reason, comment }).then((r) => r.data);

export const deliverOrder = (id: number): Promise<OrderDetail> =>
  apiClient.patch(`/admin/orders/${id}/deliver`).then((r) => r.data);

export const cancelOrder = (id: number, reason: CancelReason, comment: string): Promise<OrderDetail> =>
  apiClient.post(`/admin/orders/${id}/cancel`, { reason, comment }).then((r) => r.data);
```

Add `PartialDispatchReason` and `CancelReason` to the existing type import at the top of the file:

```ts
import { BulkConfirmResult, CancelReason, OrderDetail, OrderStatus, OrderSummary, Paged, PartialDispatchReason } from './types';
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/admin-web && npx tsc --noEmit`
Expected: fails right now — `OrderDetailPage.tsx` still calls `dispatchOrder`/`cancelOrder` with the old argument shape. That's expected; Task 7 fixes it. Confirm the *only* errors are in `OrderDetailPage.tsx`.

- [ ] **Step 4: Commit**

```bash
git add apps/admin-web/src/api/types.ts apps/admin-web/src/api/orders.ts
git commit -m "admin-web: add partial-dispatch and cancel-reason types to the orders API client"
```

---

## Task 7: admin-web — dispatch/cancel UI

**Files:**
- Modify: `apps/admin-web/src/pages/OrderDetailPage.tsx`
- Modify: `apps/admin-web/src/pages/OrdersPage.tsx`
- Modify: `apps/admin-web/src/theme.css`

**Interfaces:**
- Consumes: `ordersApi.dispatchOrder`/`cancelOrder` (Task 6), `OrderDetail.items[].dispatchStatus`, `OrderDetail.shipment.isPartial/reason/comment` (Task 6 types, populated by Task 3–4's backend).

- [ ] **Step 1: Add the `pill-warning` CSS class**

In `apps/admin-web/src/theme.css`, right after the existing `.pill-neutral { background: var(--surface-2); color: var(--muted); }` rule, add:

```css
.pill-warning { background: var(--admin-tint); color: var(--admin); }
```

- [ ] **Step 2: Update `OrderDetailPage.tsx`**

Replace the file's entire contents with:

```tsx
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import * as ordersApi from '../api/orders';
import { CancelReason, ItemDispatchStatus, OrderDetail, OrderStatus, PartialDispatchReason } from '../api/types';
import { extractErrorMessage } from '../api/client';

const STATUS_PILL: Record<OrderStatus, string> = {
  PLACED: 'pill-neutral',
  CONFIRMED: 'pill-neutral',
  DISPATCHED: 'pill-neutral',
  PARTIALLY_DISPATCHED: 'pill-warning',
  DELIVERED: 'pill-ok',
  CANCELLED: 'pill-danger',
};

const ITEM_STATUS_PILL: Record<ItemDispatchStatus, string> = {
  PENDING: 'pill-neutral',
  DISPATCHED: 'pill-ok',
  UNAVAILABLE: 'pill-danger',
};

const PARTIAL_DISPATCH_REASONS: Array<{ value: PartialDispatchReason; label: string }> = [
  { value: 'OUT_OF_STOCK', label: 'Out of stock' },
  { value: 'ITEM_DAMAGED', label: 'Item damaged' },
  { value: 'ITEM_DISCONTINUED', label: 'Item discontinued' },
  { value: 'COURIER_LIMIT', label: 'Courier weight/size limit' },
  { value: 'OTHER', label: 'Other' },
];

const CANCEL_REASONS: Array<{ value: CancelReason; label: string }> = [
  { value: 'CUSTOMER_REQUESTED', label: 'Customer requested' },
  { value: 'OUT_OF_STOCK', label: 'Out of stock' },
  { value: 'DUPLICATE_ORDER', label: 'Duplicate order' },
  { value: 'SUSPECTED_FRAUD', label: 'Suspected fraud' },
  { value: 'UNDELIVERABLE_ADDRESS', label: 'Undeliverable address' },
  { value: 'OTHER', label: 'Other' },
];

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const orderId = Number(id);
  const navigate = useNavigate();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [carrier, setCarrier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [dispatchSelected, setDispatchSelected] = useState<Set<number>>(new Set());
  const [dispatchReason, setDispatchReason] = useState<PartialDispatchReason | ''>('');
  const [dispatchComment, setDispatchComment] = useState('');
  const [cancelReason, setCancelReason] = useState<CancelReason | ''>('');
  const [cancelComment, setCancelComment] = useState('');

  const load = () => {
    ordersApi
      .getOrder(orderId)
      .then((o) => {
        setOrder(o);
        setDispatchSelected(new Set(o.items.map((i) => i.productId)));
      })
      .catch((err) => setError(extractErrorMessage(err, 'Could not load this order')));
  };

  useEffect(load, [orderId]);

  const runAction = async (action: () => Promise<OrderDetail>) => {
    setBusy(true);
    setError(null);
    try {
      setOrder(await action());
    } catch (err) {
      setError(extractErrorMessage(err, 'That action could not be completed'));
    } finally {
      setBusy(false);
    }
  };

  const toggleDispatchItem = (productId: number) => {
    setDispatchSelected((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId); else next.add(productId);
      return next;
    });
  };

  if (error && !order) {
    return <p style={{ color: 'var(--danger)' }}>{error}</p>;
  }
  if (!order) {
    return <p style={{ color: 'var(--muted)' }}>Loading…</p>;
  }

  const isPartialSelection = dispatchSelected.size > 0 && dispatchSelected.size < order.items.length;
  const dispatchDisabled =
    busy || !carrier || !trackingNumber || dispatchSelected.size === 0 ||
    (isPartialSelection && (!dispatchReason || !dispatchComment));
  const showItemPills = order.status !== 'PLACED' && order.status !== 'CONFIRMED';

  return (
    <div>
      <button className="btn-ghost" style={{ padding: 0, marginBottom: 12, fontSize: 12 }} onClick={() => navigate('/orders')}>← Back to orders</button>

      <div style={styles.headerRow}>
        <div>
          <h1 style={styles.title}>{order.orderCode}</h1>
          <p style={styles.subId}>Internal #{order.id} · {order.publicId}</p>
        </div>
        <span className={`pill ${STATUS_PILL[order.status]}`}>{order.status}</span>
      </div>

      <div style={styles.columns}>
        <div className="card" style={styles.card}>
          <h2 style={styles.sectionHeading}>Items</h2>
          {order.items.map((item) => (
            <div key={item.productId} style={styles.itemRow}>
              <span>
                {item.name} × {item.quantity}
                {showItemPills && (
                  <span className={`pill ${ITEM_STATUS_PILL[item.dispatchStatus]}`} style={{ marginLeft: 8 }}>
                    {item.dispatchStatus}
                  </span>
                )}
              </span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{'₹'}{(item.price * item.quantity).toLocaleString()}</span>
            </div>
          ))}
          <div style={{ ...styles.itemRow, ...styles.totalRow }}>
            <strong>Total</strong>
            <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{'₹'}{order.totalAmount.toLocaleString()}</strong>
          </div>
          <div style={styles.itemRow}>
            <span style={{ color: 'var(--muted)' }}>Payment</span>
            <span>{order.paymentMethod === 'COD' ? 'Cash on delivery' : order.paymentMethod}</span>
          </div>

          <h2 style={{ ...styles.sectionHeading, marginTop: 20 }}>Ship to</h2>
          <p style={styles.address}>
            {order.shippingAddress.line1}{order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ''}<br />
            {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}<br />
            {order.shippingAddress.country}
          </p>

          <h2 style={{ ...styles.sectionHeading, marginTop: 20 }}>Timeline</h2>
          {order.events.map((e, i) => (
            <div key={i} style={styles.eventRow}>
              <span style={styles.eventStatus}>{e.status}</span>
              <span style={styles.eventDate}>{new Date(e.createdAt).toLocaleString()}</span>
            </div>
          ))}

          {order.shipment && (
            <>
              <h2 style={{ ...styles.sectionHeading, marginTop: 20 }}>Tracking</h2>
              <p style={styles.address}>{order.shipment.carrier} · {order.shipment.trackingNumber}</p>
              {order.shipment.isPartial && (
                <p style={{ ...styles.address, color: 'var(--danger)', marginTop: 6 }}>
                  Partial dispatch — {order.shipment.reason}: {order.shipment.comment}
                </p>
              )}
            </>
          )}
        </div>

        <div className="card" style={styles.actionsCard}>
          <h2 style={styles.sectionHeading}>Actions</h2>
          {error && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</p>}

          {order.status === 'PLACED' && (
            <button className="btn-primary" style={styles.actionButton} disabled={busy} onClick={() => runAction(() => ordersApi.confirmOrder(order.id))}>
              Confirm order
            </button>
          )}

          {order.status === 'CONFIRMED' && (
            <div>
              <label style={styles.label}>Carrier</label>
              <input value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="BlueDart" />
              <label style={styles.label}>Tracking number</label>
              <input value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} placeholder="BD48217730IN" />

              <label style={styles.label}>Items to dispatch now</label>
              {order.items.map((item) => (
                <label key={item.productId} style={styles.checkRow}>
                  <input
                    type="checkbox"
                    checked={dispatchSelected.has(item.productId)}
                    onChange={() => toggleDispatchItem(item.productId)}
                  />
                  {item.name} × {item.quantity}
                </label>
              ))}

              {isPartialSelection && (
                <>
                  <label style={styles.label}>Reason held-back items aren't shipping</label>
                  <select value={dispatchReason} onChange={(e) => setDispatchReason(e.target.value as PartialDispatchReason)}>
                    <option value="">Select a reason…</option>
                    {PARTIAL_DISPATCH_REASONS.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                  <label style={styles.label}>Comment</label>
                  <textarea value={dispatchComment} onChange={(e) => setDispatchComment(e.target.value)} rows={2} />
                </>
              )}

              <button
                className="btn-primary"
                style={styles.actionButton}
                disabled={dispatchDisabled}
                onClick={() =>
                  runAction(() =>
                    ordersApi.dispatchOrder(
                      order.id,
                      carrier,
                      trackingNumber,
                      Array.from(dispatchSelected),
                      isPartialSelection ? (dispatchReason as PartialDispatchReason) : undefined,
                      isPartialSelection ? dispatchComment : undefined,
                    ),
                  )
                }
              >
                {isPartialSelection
                  ? `Dispatch partially (${dispatchSelected.size} of ${order.items.length} items)`
                  : 'Dispatch (all items)'}
              </button>
            </div>
          )}

          {(order.status === 'DISPATCHED' || order.status === 'PARTIALLY_DISPATCHED') && (
            <button className="btn-primary" style={styles.actionButton} disabled={busy} onClick={() => runAction(() => ordersApi.deliverOrder(order.id))}>
              Mark delivered
            </button>
          )}

          {(order.status === 'PLACED' || order.status === 'CONFIRMED') && (
            <div>
              <label style={styles.label}>Cancellation reason</label>
              <select value={cancelReason} onChange={(e) => setCancelReason(e.target.value as CancelReason)}>
                <option value="">Select a reason…</option>
                {CANCEL_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              <label style={styles.label}>Comment</label>
              <textarea value={cancelComment} onChange={(e) => setCancelComment(e.target.value)} rows={2} />
              <button
                className="btn-danger"
                style={styles.actionButton}
                disabled={busy || !cancelReason || !cancelComment}
                onClick={() => runAction(() => ordersApi.cancelOrder(order.id, cancelReason as CancelReason, cancelComment))}
              >
                Cancel order
              </button>
            </div>
          )}

          {(order.status === 'DELIVERED' || order.status === 'CANCELLED') && (
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>No further actions — this order is {order.status.toLowerCase()}.</p>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  headerRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20 },
  title: { fontSize: 20, fontWeight: 800, margin: 0 },
  subId: { fontSize: 11, color: 'var(--muted)', margin: '2px 0 0', fontFamily: 'monospace' },
  columns: { display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20, alignItems: 'start' },
  card: { padding: 20 },
  sectionHeading: { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', margin: '0 0 10px' },
  itemRow: { display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13 },
  totalRow: { borderTop: '1px solid var(--line)', marginTop: 6, paddingTop: 8 },
  address: { fontSize: 13, lineHeight: 1.6, margin: 0 },
  eventRow: { display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', borderBottom: '1px dotted var(--line)' },
  eventStatus: { fontWeight: 600 },
  eventDate: { color: 'var(--muted)' },
  actionsCard: { padding: 20, background: 'var(--admin-tint)', border: '1px solid var(--admin)' },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginTop: 10, marginBottom: 4 },
  checkRow: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '4px 0' },
  actionButton: { width: '100%', marginTop: 14, padding: '9px 0', fontSize: 13 },
};
```

- [ ] **Step 3: Update `OrdersPage.tsx`**

Replace the `STATUS_TABS` array:

```ts
const STATUS_TABS: Array<{ value: OrderStatus | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'All' },
  { value: 'PLACED', label: 'Placed' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'DISPATCHED', label: 'Dispatched' },
  { value: 'PARTIALLY_DISPATCHED', label: 'Partially dispatched' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'CANCELLED', label: 'Cancelled' },
];
```

Replace the `STATUS_PILL` map:

```ts
const STATUS_PILL: Record<OrderStatus, string> = {
  PLACED: 'pill-neutral',
  CONFIRMED: 'pill-neutral',
  DISPATCHED: 'pill-neutral',
  PARTIALLY_DISPATCHED: 'pill-warning',
  DELIVERED: 'pill-ok',
  CANCELLED: 'pill-danger',
};
```

- [ ] **Step 4: Typecheck**

Run: `cd apps/admin-web && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Manual check**

With the full stack running (`npm run start:infra`, `npm run start:all` from the repo root, `npm run dev` in `apps/admin-web`):
1. Place an order as a customer (mobile app or `curl`), confirm it as admin.
2. Open the order in admin-web, uncheck one item, confirm the reason/comment fields appear and the button is disabled until both are filled, then dispatch. Verify the order shows `PARTIALLY_DISPATCHED` with an amber pill and the item pills (`DISPATCHED`/`UNAVAILABLE`).
3. Place and confirm a second order, cancel it — confirm the button stays disabled until both reason and comment are filled.

- [ ] **Step 6: Commit**

```bash
git add apps/admin-web/src/pages/OrderDetailPage.tsx apps/admin-web/src/pages/OrdersPage.tsx apps/admin-web/src/theme.css
git commit -m "admin-web: partial-dispatch item selection and cancel-reason forms"
```

---

## Task 8: mobile — types

**Files:**
- Modify: `apps/mobile/src/api/types.ts`

**Interfaces:**
- Produces: same shape as Task 6's admin-web types (`OrderStatus` gains `'PARTIALLY_DISPATCHED'`, `ItemDispatchStatus`, `OrderItem.dispatchStatus`, `Shipment.isPartial/reason/comment`, `OrderSummary.hasUnseenUpdate`) — consumed by Tasks 9–10. No `PartialDispatchReason`/`CancelReason` needed here — the customer app never sends those.

- [ ] **Step 1: Update `types.ts`**

Replace:

```ts
export type OrderStatus = 'PLACED' | 'CONFIRMED' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED';

export interface OrderItem {
  productId: number;
  name: string;
  price: number;
  quantity: number;
}

export interface OrderEvent {
  status: OrderStatus;
  note: string | null;
  createdAt: string;
}

export interface Shipment {
  carrier: string;
  trackingNumber: string;
  dispatchedAt: string;
  deliveredAt: string | null;
}

export interface OrderSummary {
  id: number;
  publicId: string;
  orderCode: string;
  userId: number;
  status: OrderStatus;
  totalAmount: number;
  paymentMethod: 'COD';
  createdAt: string;
}
```

with:

```ts
export type OrderStatus = 'PLACED' | 'CONFIRMED' | 'DISPATCHED' | 'PARTIALLY_DISPATCHED' | 'DELIVERED' | 'CANCELLED';
export type ItemDispatchStatus = 'PENDING' | 'DISPATCHED' | 'UNAVAILABLE';

export interface OrderItem {
  productId: number;
  name: string;
  price: number;
  quantity: number;
  dispatchStatus: ItemDispatchStatus;
}

export interface OrderEvent {
  status: OrderStatus;
  note: string | null;
  createdAt: string;
}

export interface Shipment {
  carrier: string;
  trackingNumber: string;
  dispatchedAt: string;
  deliveredAt: string | null;
  isPartial: boolean;
  reason: string | null;
  comment: string | null;
}

export interface OrderSummary {
  id: number;
  publicId: string;
  orderCode: string;
  userId: number;
  status: OrderStatus;
  totalAmount: number;
  paymentMethod: 'COD';
  createdAt: string;
  hasUnseenUpdate: boolean;
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors — every existing usage of these types (`orders.tsx`, `order/[id].tsx`, `StatusTimeline.tsx`) only reads fields that already existed, so adding fields doesn't break anything yet.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/api/types.ts
git commit -m "mobile: add PARTIALLY_DISPATCHED status and per-item/shipment fields to order types"
```

---

## Task 9: mobile — order detail and status timeline

**Files:**
- Modify: `apps/mobile/src/components/StatusTimeline.tsx`
- Modify: `apps/mobile/src/app/order/[id].tsx`
- Modify: `apps/mobile/src/app/(app)/orders.tsx`

**Interfaces:**
- Consumes: `OrderStatus`, `OrderItem.dispatchStatus`, `Shipment.isPartial/reason/comment` (Task 8).

This task has no Jest suite in `apps/mobile` today (no test runner is configured for this package) — verification is a manual run per Step 4, which is why the Review Focus item for this exact regression (an unhandled enum value breaking the timeline) is checked by hand here rather than by an automated test.

- [ ] **Step 1: Update `StatusTimeline.tsx`**

Replace the file's entire contents with:

```tsx
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { OrderStatus } from '../api/types';
import { colors, spacing } from '../theme';

const STEPS: OrderStatus[] = ['PLACED', 'CONFIRMED', 'DISPATCHED', 'DELIVERED'];

/** PARTIALLY_DISPATCHED occupies the same progress slot as DISPATCHED — it's an alternate outcome of the same step, not a fifth step. */
function stepIndex(status: OrderStatus): number {
  if (status === 'PARTIALLY_DISPATCHED') return STEPS.indexOf('DISPATCHED');
  return STEPS.indexOf(status);
}

interface Props {
  status: OrderStatus;
  events: { status: OrderStatus; createdAt: string }[];
}

export default function StatusTimeline({ status, events }: Props) {
  if (status === 'CANCELLED') {
    const cancelledAt = events.find((e) => e.status === 'CANCELLED')?.createdAt;
    return (
      <View style={styles.cancelledRow}>
        <View style={[styles.dot, styles.dotCancelled]} />
        <View>
          <Text style={styles.stepLabelCancelled}>Cancelled</Text>
          {cancelledAt && <Text style={styles.stepDate}>{new Date(cancelledAt).toLocaleString()}</Text>}
        </View>
      </View>
    );
  }

  const currentIndex = stepIndex(status);

  return (
    <View>
      {STEPS.map((step, i) => {
        const isDispatchStep = step === 'DISPATCHED';
        const event = events.find((e) => e.status === step || (isDispatchStep && e.status === 'PARTIALLY_DISPATCHED'));
        const done = i <= currentIndex;
        const isCurrent = i === currentIndex;
        const label =
          isDispatchStep && status === 'PARTIALLY_DISPATCHED'
            ? 'Partially dispatched'
            : step.charAt(0) + step.slice(1).toLowerCase();
        return (
          <View key={step} style={styles.row}>
            <View style={styles.dotColumn}>
              <View style={[styles.dot, done && styles.dotDone, isCurrent && styles.dotCurrent]} />
              {i < STEPS.length - 1 && <View style={[styles.line, i < currentIndex && styles.lineDone]} />}
            </View>
            <View style={styles.stepText}>
              <Text style={[styles.stepLabel, isCurrent && styles.stepLabelCurrent, !done && styles.stepLabelPending]}>
                {label}
              </Text>
              {event && <Text style={styles.stepDate}>{new Date(event.createdAt).toLocaleString()}</Text>}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  dotColumn: { alignItems: 'center', width: 20 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface },
  dotDone: { borderColor: colors.success, backgroundColor: colors.success },
  dotCurrent: { borderColor: colors.primary, backgroundColor: colors.primary },
  dotCancelled: { borderColor: colors.danger, backgroundColor: colors.danger },
  line: { width: 2, flex: 1, minHeight: 24, backgroundColor: colors.border },
  lineDone: { backgroundColor: colors.success },
  stepText: { flex: 1, paddingBottom: spacing.md, marginLeft: spacing.sm },
  stepLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  stepLabelCurrent: { color: colors.primary },
  stepLabelPending: { color: colors.muted, fontWeight: '400' },
  stepLabelCancelled: { fontSize: 14, fontWeight: '700', color: colors.danger },
  stepDate: { fontSize: 11, color: colors.muted, marginTop: 2 },
  cancelledRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
```

- [ ] **Step 2: Update `order/[id].tsx`**

Add an item-status color map right after the imports:

```ts
const ITEM_STATUS_COLORS: Record<string, string> = {
  PENDING: colors.muted,
  DISPATCHED: colors.success,
  UNAVAILABLE: colors.danger,
};
```

Replace the items-rendering block:

```tsx
      <Text style={styles.sectionHeading}>Items</Text>
      {order.items.map((item) => (
        <View key={item.productId} style={styles.itemRow}>
          <Text style={styles.itemName} numberOfLines={1}>{item.name} × {item.quantity}</Text>
          <Text style={styles.itemPrice}>{'₹'}{(item.price * item.quantity).toLocaleString()}</Text>
        </View>
      ))}
```

with:

```tsx
      <Text style={styles.sectionHeading}>Items</Text>
      {order.items.map((item) => {
        const showPill = order.status !== 'PLACED' && order.status !== 'CONFIRMED';
        return (
          <View key={item.productId} style={styles.itemRow}>
            <View style={{ flex: 1, marginRight: spacing.sm }}>
              <Text style={styles.itemName} numberOfLines={1}>{item.name} × {item.quantity}</Text>
              {showPill && (
                <Text style={[styles.itemStatus, { color: ITEM_STATUS_COLORS[item.dispatchStatus] }]}>{item.dispatchStatus}</Text>
              )}
            </View>
            <Text style={styles.itemPrice}>{'₹'}{(item.price * item.quantity).toLocaleString()}</Text>
          </View>
        );
      })}
```

Replace the tracking box (add the partial-dispatch note):

```tsx
      {order.shipment && (
        <View style={styles.trackingBox}>
          <Text style={styles.sectionHeading}>Tracking</Text>
          <Text style={styles.trackingNumber}>{order.shipment.trackingNumber}</Text>
          <Text style={styles.trackingCarrier}>Carrier: {order.shipment.carrier}</Text>
        </View>
      )}
```

with:

```tsx
      {order.shipment && (
        <View style={styles.trackingBox}>
          <Text style={styles.sectionHeading}>Tracking</Text>
          <Text style={styles.trackingNumber}>{order.shipment.trackingNumber}</Text>
          <Text style={styles.trackingCarrier}>Carrier: {order.shipment.carrier}</Text>
          {order.shipment.isPartial && (
            <Text style={[styles.trackingCarrier, { color: colors.danger, marginTop: 4 }]}>
              Partial dispatch — {order.shipment.reason}: {order.shipment.comment}
            </Text>
          )}
        </View>
      )}
```

Add one new style to the `StyleSheet.create` call, alongside `itemName`:

```ts
  itemStatus: { fontSize: 10, fontWeight: '700', marginTop: 1, textTransform: 'uppercase' },
```

- [ ] **Step 3: Update `orders.tsx`**

Replace the `STATUS_COLORS` map:

```ts
const STATUS_COLORS: Record<string, string> = {
  PLACED: colors.primary,
  CONFIRMED: colors.primary,
  DISPATCHED: colors.primary,
  DELIVERED: colors.success,
  CANCELLED: colors.danger,
};
```

with:

```ts
const STATUS_COLORS: Record<string, string> = {
  PLACED: colors.primary,
  CONFIRMED: colors.primary,
  DISPATCHED: colors.primary,
  PARTIALLY_DISPATCHED: colors.primary,
  DELIVERED: colors.success,
  CANCELLED: colors.danger,
};
```

- [ ] **Step 4: Typecheck and manual verification**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors.

Manual (with the full stack + `npx expo start --web -c` running, logged in as the customer from Task 5's e2e scenario, or any customer with a partially-dispatched order): open Orders → the partially-dispatched order → confirm the timeline shows "Partially dispatched" as the current (highlighted) step rather than a blank/broken progress bar, the tracking box shows the partial reason/comment, and each item shows its `DISPATCHED`/`UNAVAILABLE` label.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/components/StatusTimeline.tsx "apps/mobile/src/app/order/[id].tsx" apps/mobile/src/app/\(app\)/orders.tsx
git commit -m "mobile: render PARTIALLY_DISPATCHED in the timeline and per-item dispatch status"
```

---

## Task 10: mobile — unseen-update badge

**Files:**
- Create: `apps/mobile/src/context/OrdersContext.tsx`
- Modify: `apps/mobile/src/app/_layout.tsx`
- Modify: `apps/mobile/src/app/(app)/_layout.tsx`
- Modify: `apps/mobile/src/app/order/[id].tsx`

**Interfaces:**
- Consumes: `ordersApi.getOrders()` (existing, `apps/mobile/src/api/orders.ts` — unchanged signature), `OrderSummary.hasUnseenUpdate` (Task 8), `useAuth()` (existing `AuthContext`).
- Produces: `OrdersProvider` (React context provider), `useOrdersBadge(): { unseenCount: number; refresh: () => Promise<void> }`.

- [ ] **Step 1: Create `OrdersContext.tsx`**

```tsx
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import * as ordersApi from '../api/orders';
import { useAuth } from './AuthContext';

interface OrdersContextValue {
  unseenCount: number;
  refresh: () => Promise<void>;
}

const OrdersContext = createContext<OrdersContextValue | undefined>(undefined);

export function OrdersProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [unseenCount, setUnseenCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!user) {
      setUnseenCount(0);
      return;
    }
    const result = await ordersApi.getOrders();
    setUnseenCount(result.data.filter((o) => o.hasUnseenUpdate).length);
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return <OrdersContext.Provider value={{ unseenCount, refresh }}>{children}</OrdersContext.Provider>;
}

export function useOrdersBadge(): OrdersContextValue {
  const ctx = useContext(OrdersContext);
  if (!ctx) throw new Error('useOrdersBadge must be used within an OrdersProvider');
  return ctx;
}
```

- [ ] **Step 2: Wire `OrdersProvider` into the root layout**

In `apps/mobile/src/app/_layout.tsx`, add the import:

```ts
import { OrdersProvider } from '../context/OrdersContext';
```

Replace the provider nesting in `RootLayout`:

```tsx
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <CartProvider>
          <RootNavigator />
          <StatusBar style="auto" />
        </CartProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
```

with:

```tsx
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <CartProvider>
          <OrdersProvider>
            <RootNavigator />
            <StatusBar style="auto" />
          </OrdersProvider>
        </CartProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
```

- [ ] **Step 3: Add the tab badge**

In `apps/mobile/src/app/(app)/_layout.tsx`, add the import:

```ts
import { useOrdersBadge } from '../../context/OrdersContext';
```

Add the hook call and use it on the Orders tab:

```tsx
export default function AppTabsLayout() {
  const { itemCount } = useCart();
  const { unseenCount } = useOrdersBadge();

  return (
    <Tabs
      screenOptions={{
        headerTitleStyle: { fontWeight: '800' },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'SalesCart', tabBarLabel: 'Shop' }} />
      <Tabs.Screen
        name="cart"
        options={{ title: 'Cart', tabBarBadge: itemCount > 0 ? itemCount : undefined }}
      />
      <Tabs.Screen
        name="orders"
        options={{ title: 'My Orders', tabBarLabel: 'Orders', tabBarBadge: unseenCount > 0 ? unseenCount : undefined }}
      />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
```

- [ ] **Step 4: Refresh the badge after opening an order**

In `apps/mobile/src/app/order/[id].tsx`, add the import:

```ts
import { useOrdersBadge } from '../../context/OrdersContext';
```

In the component, call the hook and refresh after a successful load:

```tsx
export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const orderId = Number(id);
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const { refresh: refreshOrdersBadge } = useOrdersBadge();

  const load = useCallback(() => {
    ordersApi
      .getOrder(orderId)
      .then((o) => {
        setOrder(o);
        void refreshOrdersBadge();
      })
      .catch((err) => setError(extractErrorMessage(err, 'Could not load this order')));
  }, [orderId, refreshOrdersBadge]);

  useFocusEffect(load);
```

- [ ] **Step 5: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Manual verification**

With the full stack + `npx expo start --web -c` running: as an admin, dispatch (or partially dispatch / cancel) an order belonging to a customer test account. Log in as that customer — confirm the Orders tab shows a badge. Open the affected order — confirm the badge count drops (or disappears if it was the only unseen order) after returning to the tab bar.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/context/OrdersContext.tsx apps/mobile/src/app/_layout.tsx apps/mobile/src/app/\(app\)/_layout.tsx "apps/mobile/src/app/order/[id].tsx"
git commit -m "mobile: add Orders-tab unseen-update badge"
```
