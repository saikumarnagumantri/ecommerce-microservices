import { ApiPropertyOptional, ApiProperty, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateAddressDto {
  @ApiProperty({ example: '12 Lake Road' })
  @IsString()
  line1!: string;

  @ApiPropertyOptional({ example: 'Near City Park' })
  @IsOptional()
  @IsString()
  line2?: string;

  @ApiProperty({ example: 'Pune' })
  @IsString()
  city!: string;

  @ApiProperty({ example: 'Maharashtra' })
  @IsString()
  state!: string;

  @ApiProperty({ example: '411001' })
  @IsString()
  postalCode!: string;

  @ApiProperty({ example: 'India' })
  @IsString()
  country!: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateAddressDto extends PartialType(CreateAddressDto) {}
