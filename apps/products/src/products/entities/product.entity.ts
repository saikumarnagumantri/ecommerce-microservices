import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * E2 redesign: the E0-4 shape (`category` int, `spec` jsonb, `offers`
 * jsonb, `images` text[], `isOutOfStock`) is gone. Category is now a real
 * FK to `categories`; brand is its own column; features and media each
 * have their own table (ProductFeature, ProductMedia); stock/availability
 * live only in the inventory service, never duplicated here.
 */
@Entity({ name: 'products', schema: 'products' })
export class Product {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'int' })
  categoryId!: number;

  @Column({ type: 'varchar', length: 128 })
  brand!: string;

  @Column({ type: 'int' })
  originalPrice!: number;

  @Column({ type: 'int' })
  discountPrice!: number;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  // Admin-set override, independent of the inventory service's real stock
  // count: lets a product be shown as out of stock (e.g. a recall, a
  // supplier issue) without touching actual inventory numbers.
  @Column({ type: 'boolean', default: false })
  forceOutOfStock!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
