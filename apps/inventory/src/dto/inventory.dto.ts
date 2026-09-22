import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsObject, IsOptional, IsString, Min } from 'class-validator';

export class InventoryDTO {
  @ApiProperty({ example: 101 })
  productId!: number;

  @ApiProperty({ example: 100 })
  stock!: number;

  @ApiProperty({ example: true })
  isAvailable!: boolean;
}

export class InventoryUpdateDTO {
  @ApiProperty({ example: 101 })
  @IsInt()
  productId!: number;

  @ApiProperty({ example: 100 })
  @IsInt()
  @Min(0)
  stock!: number;
}

export interface OrderLine {
  quantity: number;
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
  // Not @ValidateNested()/@Type(): those validate a single nested object
  // or an array of them, not "each value of this dictionary object" — on
  // a Record like this they instead try to validate `items` itself as
  // one OrderLineDto, which silently mis-validates every real key as an
  // unexpected property. Each line's quantity is checked manually in
  // InventoryService instead.
  @IsObject()
  items!: Record<number, OrderLine>;

  @ApiPropertyOptional({ example: 'order-1042', description: 'Order id, recorded on each movement row for traceability.' })
  @IsOptional()
  @IsString()
  refId?: string;
}

export class UpdateInventoryByProductIdDTO {
  @ApiProperty({ example: 10 })
  @IsInt()
  @Min(0)
  stock!: number;
}

export class RestockDto {
  @ApiProperty({ example: 25, description: 'Units to add to current stock.' })
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class AdjustStockDto {
  @ApiProperty({ example: -3, description: 'Signed change to apply to current stock (e.g. -3 for a shrinkage correction).' })
  @IsInt()
  delta!: number;
}

export class LowStockQueryDto {
  @ApiPropertyOptional({ example: 5, default: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  threshold?: number;
}
