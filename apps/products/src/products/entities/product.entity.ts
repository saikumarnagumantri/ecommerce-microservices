import { Column, Entity, PrimaryColumn } from 'typeorm';

export interface ProductSpec {
  name: string;
  brand: string;
  yearOfManufacture: string;
  material: string;
}

export interface ProductOffer {
  bankCard: string;
  minPriceToApply: number;
  maxDiscount: number;
  discountPercentage: number;
}

/**
 * Mirrors ProductDTO / the old in-memory PRODUCTS shape as-is. Reworking
 * this into categoryId/brand/isActive plus dedicated feature and media
 * tables is E2's job (E2-1..E2-3), not this story's.
 */
@Entity({ name: 'products', schema: 'products' })
export class Product {
  @PrimaryColumn({ type: 'int' })
  id!: number;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'int' })
  category!: number;

  @Column({ type: 'jsonb' })
  spec!: ProductSpec;

  @Column({ type: 'int' })
  originalPrice!: number;

  @Column({ type: 'int' })
  discountPrice!: number;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  offers!: ProductOffer[];

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  images!: string[];

  @Column({ type: 'boolean', default: false })
  isOutOfStock!: boolean;
}
