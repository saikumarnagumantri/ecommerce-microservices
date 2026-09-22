import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum MovementReason {
  RESTOCK = 'RESTOCK',
  ORDER = 'ORDER',
  CANCEL = 'CANCEL',
  ADJUST = 'ADJUST',
}

@Entity({ name: 'inventory_movements', schema: 'inventory' })
export class InventoryMovement {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  productId!: number;

  /** Positive for stock added (restock, cancel), negative for stock removed (order, a downward adjust). */
  @Column({ type: 'int' })
  delta!: number;

  @Column({ type: 'varchar', length: 16 })
  reason!: MovementReason;

  @Column({ type: 'varchar', length: 64, nullable: true })
  refId!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
