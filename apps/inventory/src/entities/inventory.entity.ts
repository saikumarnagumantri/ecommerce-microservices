import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'inventory', schema: 'inventory' })
export class Inventory {
  @PrimaryColumn({ type: 'int' })
  productId!: number;

  @Column({ type: 'int' })
  stock!: number;

  @Column({ type: 'boolean', default: false })
  isAvailable!: boolean;
}
