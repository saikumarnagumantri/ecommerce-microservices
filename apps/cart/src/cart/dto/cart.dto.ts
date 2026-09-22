import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class AddCartItemDto {
  @ApiProperty({ example: 101 })
  @IsInt()
  productId!: number;

  @ApiProperty({ example: 1, description: 'Added to any existing quantity for this product.' })
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class SetCartItemQuantityDto {
  @ApiProperty({ example: 2, description: 'The new quantity; 0 or below removes the item.' })
  @IsInt()
  quantity!: number;
}

class CartItemResponseDto {
  @ApiProperty({ example: 101 })
  productId!: number;

  @ApiProperty({ example: 2 })
  quantity!: number;

  @ApiProperty({ example: 'UltraBook Pro 15' })
  name!: string;

  @ApiProperty({ example: 1350 })
  price!: number;

  @ApiProperty({ example: 2700 })
  subtotal!: number;

  @ApiProperty({ example: true })
  isAvailable!: boolean;

  @ApiProperty({ example: false, description: 'True if the requested quantity exceeded stock and was capped.' })
  wasCapped!: boolean;
}

export class CartResponseDto {
  @ApiProperty({ example: 1 })
  userId!: number;

  @ApiProperty({ type: [CartItemResponseDto] })
  items!: CartItemResponseDto[];

  @ApiProperty({ example: 4050 })
  total!: number;
}
