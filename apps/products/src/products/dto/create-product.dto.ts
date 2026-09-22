import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

export class CreateProductDto {
  @ApiProperty({ example: 'UltraBook Pro 15' })
  @IsString()
  name!: string;

  @ApiProperty({ example: 'Professional grade laptop with 4K OLED display.' })
  @IsString()
  description!: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  categoryId!: number;

  @ApiProperty({ example: 'TechNova' })
  @IsString()
  brand!: string;

  @ApiProperty({ example: 1500 })
  @IsInt()
  @Min(0)
  originalPrice!: number;

  @ApiProperty({ example: 1350 })
  @IsInt()
  @Min(0)
  discountPrice!: number;

  @ApiPropertyOptional({ example: 20, default: 0, description: 'Starting stock; creates the matching inventory row.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  initialStock?: number;
}

export class UpdateProductDto extends PartialType(OmitType(CreateProductDto, ['initialStock'] as const)) {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: false, description: 'Manually force this product to show as out of stock, regardless of real inventory.' })
  @IsOptional()
  @IsBoolean()
  forceOutOfStock?: boolean;
}

export class BulkCreateProductsDto {
  @ApiProperty({ type: [CreateProductDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateProductDto)
  products!: CreateProductDto[];
}
