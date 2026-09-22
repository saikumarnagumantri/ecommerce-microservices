import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'product_features', schema: 'products' })
export class ProductFeature {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  productId!: number;

  @Column({ type: 'varchar', length: 128 })
  label!: string;

  @Column({ type: 'varchar', length: 255 })
  value!: string;

  @Column({ type: 'int', default: 0 })
  sortOrder!: number;
}
