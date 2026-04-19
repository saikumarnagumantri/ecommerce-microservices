import { ApiProperty } from '@nestjs/swagger';

class ProductSpecDto {
  @ApiProperty()
  readonly name!: string;
  @ApiProperty()
  readonly brand!: string;
  @ApiProperty()
  readonly yearOfManufacture!: Date;
  @ApiProperty()
  readonly material!: string;
}

class OfferDto {
  @ApiProperty()
  readonly bankCard!: string;
  @ApiProperty()
  readonly minPriceToApply!: number;
  @ApiProperty()
  readonly maxDiscount!: number;
  @ApiProperty()
  readonly discountPercentage!: number;
}
export class ProductDTO {
  @ApiProperty()
  readonly id!: number;
  @ApiProperty()
  readonly name!: string;
  @ApiProperty()
  readonly description!: string;
  @ApiProperty()
  readonly category!: number;
  @ApiProperty()
  readonly spec!: ProductSpecDto;
  @ApiProperty()
  readonly originalPrice!: number;
  @ApiProperty()
  readonly discountPrice!: number;
  @ApiProperty()
  readonly offers!: OfferDto[];
  @ApiProperty()
  readonly images!: string[];
}
