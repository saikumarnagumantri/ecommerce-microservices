import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MediaType } from '../entities/product-media.entity';

export class ProductFeatureResponseDto {
  @ApiProperty({ example: 'Display' })
  label!: string;

  @ApiProperty({ example: '15" 4K OLED' })
  value!: string;

  @ApiProperty({ example: 0 })
  sortOrder!: number;
}

export class ProductMediaResponseDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ enum: MediaType, example: MediaType.IMAGE })
  type!: MediaType;

  @ApiProperty({ example: 'http://localhost:3005/media/abc123.jpg' })
  url!: string;

  @ApiProperty({ example: 0 })
  sortOrder!: number;

  @ApiProperty({ example: true })
  isPrimary!: boolean;
}

export class ProductSummaryDto {
  @ApiProperty({ example: 101 })
  id!: number;

  @ApiProperty({ example: 'UltraBook Pro 15' })
  name!: string;

  @ApiProperty({ example: 'TechNova' })
  brand!: string;

  @ApiProperty({ example: 1 })
  categoryId!: number;

  @ApiProperty({ example: 1500 })
  originalPrice!: number;

  @ApiProperty({ example: 1350 })
  discountPrice!: number;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: false, description: 'Admin override: forces isAvailable to false regardless of real stock.' })
  forceOutOfStock!: boolean;

  @ApiPropertyOptional({ example: 'http://localhost:3005/media/abc123.jpg', nullable: true })
  primaryImageUrl!: string | null;

  @ApiProperty({ example: true, description: 'Live stock check, batched per page — lets a list screen show an out-of-stock badge without a per-item call.' })
  isAvailable!: boolean;

  @ApiProperty()
  createdAt!: Date;
}

export class ProductDetailDto extends ProductSummaryDto {
  @ApiProperty({ example: 'Professional grade laptop with 4K OLED display.' })
  description!: string;

  @ApiProperty({ type: [ProductFeatureResponseDto] })
  features!: ProductFeatureResponseDto[];

  @ApiProperty({ type: [ProductMediaResponseDto] })
  media!: ProductMediaResponseDto[];

  @ApiProperty({ example: 18 })
  stock!: number;
}

export class PagedProductsDto {
  @ApiProperty({ type: [ProductSummaryDto] })
  data!: ProductSummaryDto[];

  @ApiProperty({ example: 42 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 3 })
  totalPages!: number;
}

export class BulkCreateFailureDto {
  @ApiProperty({ example: 2, description: 'Index into the submitted products array.' })
  index!: number;

  @ApiProperty({ example: 'Discount price cannot exceed the original price' })
  error!: string;
}

export class BulkCreateProductsResultDto {
  @ApiProperty({ type: [ProductDetailDto] })
  created!: ProductDetailDto[];

  @ApiProperty({ type: [BulkCreateFailureDto] })
  failed!: BulkCreateFailureDto[];
}
