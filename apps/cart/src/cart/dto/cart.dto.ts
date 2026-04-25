import { ApiProperty } from '@nestjs/swagger';

class CartItemResponseDto {
  @ApiProperty({ example: 101 })
  productId!: number;

  @ApiProperty({ example: 2 })
  quantity!: number;

  @ApiProperty({ example: 'Laptop' })
  name!: string;

  @ApiProperty({ example: 1200 })
  price!: number;

  @ApiProperty({ example: true })
  isAvailable!: boolean;
}

export class CartResponseDto {
  @ApiProperty({ example: 1 })
  userId!: number;

  @ApiProperty({ type: [CartItemResponseDto] })
  items!: CartItemResponseDto[];
}

export class CartDTO {
  @ApiProperty({ example: 101 })
  productId!: number;

  @ApiProperty({ example: 1 })
  quantity!: number;

  @ApiProperty({ example: 123455 })
  userId!: number;
}

export class CartAddRemoveDTO {
  @ApiProperty({ example: 101 })
  productId!: number;

  @ApiProperty({ example: 1 })
  quantity!: number;

  @ApiProperty({ example: 123455 })
  userId!: number;
}
