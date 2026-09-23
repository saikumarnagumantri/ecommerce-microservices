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

  @Column({ type: 'varchar', length: 32, default: OrderStatus.PLACED })
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
