import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum MediaType {
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
}

@Entity({ name: 'product_media', schema: 'products' })
export class ProductMedia {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  productId!: number;

  @Column({ type: 'varchar', length: 16 })
  type!: MediaType;

  @Column({ type: 'text' })
  url!: string;

  @Column({ type: 'int', default: 0 })
  sortOrder!: number;

  @Column({ type: 'boolean', default: false })
  isPrimary!: boolean;
}
