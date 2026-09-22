import { ApiProperty } from '@nestjs/swagger';
import { IsInt } from 'class-validator';

export class CreateOrderDto {
  @ApiProperty({ example: 1, description: "One of the customer's saved addresses." })
  @IsInt()
  addressId!: number;

  // paymentMethod is deliberately not accepted here: COD is the only
  // method this sprint supports (E5-7), so it's set server-side.
}
