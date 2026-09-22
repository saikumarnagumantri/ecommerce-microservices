import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '@salescart/common';
import { IsEnum, IsISO8601, IsOptional } from 'class-validator';
import { OrderStatus } from '../entities/order.entity';

export class AdminOrderQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional({ example: '2026-01-01', description: 'Inclusive lower bound on createdAt.' })
  @IsOptional()
  @IsISO8601()
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-12-31', description: 'Inclusive upper bound on createdAt.' })
  @IsOptional()
  @IsISO8601()
  dateTo?: string;
}
