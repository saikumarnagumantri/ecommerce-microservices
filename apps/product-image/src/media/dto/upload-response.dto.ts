import { ApiProperty } from '@nestjs/swagger';

export class UploadResponseDto {
  @ApiProperty({ example: 'http://localhost:3005/media/8f14e-....jpg' })
  url!: string;

  @ApiProperty({ example: 'IMAGE', enum: ['IMAGE', 'VIDEO'] })
  type!: 'IMAGE' | 'VIDEO';

  @ApiProperty({ example: 245678 })
  size!: number;

  @ApiProperty({ example: 'image/jpeg' })
  mimeType!: string;
}
