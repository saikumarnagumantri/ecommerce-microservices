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
}
