import { ApiProperty } from '@nestjs/swagger';

export class InventoryDTO {
  @ApiProperty({ example: 101 })
  productId!: number;

  @ApiProperty({ example: 100 })
  inStock!: number;

  @ApiProperty({ example: true })
  isOutOfStock!: boolean;
}

export class InventoryUpdateDTO {
  @ApiProperty({ example: 101 })
  productId!: number;

  @ApiProperty({ example: 100 })
  inStock!: number;

  @ApiProperty({ example: true })
  isOutOfStock!: boolean;
}

export class InventoryOrderPlacedOrCancelDTO {
  @ApiProperty({
    type: 'object',
    additionalProperties: {
      type: 'object',
      properties: {
        quantity: { type: 'number' },
      },
    },
    example: {
      101: { quantity: 4 },
      102: { quantity: 10 },
    },
  })
  items!: Record<number, { quantity: number }>;
}
