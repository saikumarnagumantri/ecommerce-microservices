import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, Matches } from 'class-validator';
import { CANCEL_REASONS } from '../constants/orders.constants';
import type { CancelReason } from '../constants/orders.constants';

export class CancelOrderDto {
  @ApiProperty({ enum: CANCEL_REASONS })
  @IsIn(CANCEL_REASONS)
  reason!: CancelReason;

  @ApiProperty({ example: 'Customer called asking to cancel.', description: 'Must contain at least one non-whitespace character.' })
  @IsString()
  @Matches(/\S/, { message: 'comment must not be blank' })
  comment!: string;
}
