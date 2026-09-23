import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, MinLength } from 'class-validator';
import { CANCEL_REASONS } from '../constants/orders.constants';
import type { CancelReason } from '../constants/orders.constants';

export class CancelOrderDto {
  @ApiProperty({ enum: CANCEL_REASONS })
  @IsIn(CANCEL_REASONS)
  reason!: CancelReason;

  @ApiProperty({ example: 'Customer called asking to cancel.' })
  @IsString()
  @MinLength(1)
  comment!: string;
}
