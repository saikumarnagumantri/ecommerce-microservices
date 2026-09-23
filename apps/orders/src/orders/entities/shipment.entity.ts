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
