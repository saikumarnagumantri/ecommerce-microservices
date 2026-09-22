import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '@salescart/common';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString } from 'class-validator';

export class ProductQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'laptop' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  categoryId?: number;
}
