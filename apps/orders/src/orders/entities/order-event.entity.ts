import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { OrderStatus } from './order.entity';

/** One row per status transition — the timeline shown on the order detail screen. */
@Entity({ name: 'order_events', schema: 'orders' })
export class OrderEvent {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  orderId!: number;

  @Column({ type: 'varchar', length: 16 })
  status!: OrderStatus;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  /** userId of whoever caused this transition (the customer, or an admin). */
  @Column({ type: 'int' })
  actorId!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
