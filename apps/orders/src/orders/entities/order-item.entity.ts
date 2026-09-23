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
