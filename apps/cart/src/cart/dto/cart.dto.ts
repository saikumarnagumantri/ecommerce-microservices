import { ApiProperty } from '@nestjs/swagger';

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
