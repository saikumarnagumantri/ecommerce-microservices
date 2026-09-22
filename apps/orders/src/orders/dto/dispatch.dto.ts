import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class DispatchOrderDto {
  @ApiProperty({ example: 'BlueDart' })
  @IsString()
  @MinLength(1)
  carrier!: string;

  @ApiProperty({ example: 'BD48217730IN' })
  @IsString()
  @MinLength(1)
  trackingNumber!: string;
}
