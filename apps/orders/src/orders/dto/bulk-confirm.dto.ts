import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsInt } from 'class-validator';

export class BulkConfirmDto {
  @ApiProperty({ type: [Number], example: [1042, 1043, 1044] })
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  orderIds!: number[];
}
