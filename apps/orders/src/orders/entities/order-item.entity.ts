import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

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
}
