import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMinSize, ArrayUnique, IsArray, IsIn, IsInt, IsOptional, IsString, MinLength } from 'class-validator';
import { PARTIAL_DISPATCH_REASONS } from '../constants/orders.constants';
import type { PartialDispatchReason } from '../constants/orders.constants';

export class DispatchOrderDto {
  @ApiProperty({ example: 'BlueDart' })
  @IsString()
  @MinLength(1)
  carrier!: string;

  @ApiProperty({ example: 'BD48217730IN' })
  @IsString()
  @MinLength(1)
  trackingNumber!: string;

  @ApiProperty({
    type: [Number],
    example: [101, 102],
    description: "Product ids from this order's PENDING items to dispatch now. Any pending item not listed becomes UNAVAILABLE.",
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsInt({ each: true })
  dispatchedProductIds!: number[];

  @ApiPropertyOptional({ enum: PARTIAL_DISPATCH_REASONS, description: "Required when dispatchedProductIds is a proper subset of the order's pending items." })
  @IsOptional()
  @IsIn(PARTIAL_DISPATCH_REASONS)
  reason?: PartialDispatchReason;

  @ApiPropertyOptional({ description: 'Required whenever reason is required.' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  comment?: string;
}
