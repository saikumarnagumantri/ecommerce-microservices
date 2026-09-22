import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString } from 'class-validator';

export class CategoryDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'Electronics' })
  name!: string;

  @ApiProperty({ example: null, nullable: true })
  parentId!: number | null;
}

export class CreateCategoryDto {
  @ApiProperty({ example: 'Electronics' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ example: null, nullable: true, description: 'Parent category id, for a subcategory.' })
  @IsOptional()
  @IsInt()
  parentId?: number | null;
}

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}
