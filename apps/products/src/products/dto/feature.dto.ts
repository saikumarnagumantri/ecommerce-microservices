import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsString, ValidateNested } from 'class-validator';

export class FeatureItemDto {
  @ApiProperty({ example: 'Display' })
  @IsString()
  label!: string;

  @ApiProperty({ example: '15" 4K OLED' })
  @IsString()
  value!: string;
}

/** The whole feature list is replaced in one call — order in the array becomes sortOrder. */
export class ReplaceFeaturesDto {
  @ApiProperty({ type: [FeatureItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FeatureItemDto)
  features!: FeatureItemDto[];
}
