import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/**
 * Deliberately has no `role` field: with the global validation pipe in
 * strict mode, any attempt to send one is rejected outright rather than
 * silently ignored, so "a user can't change their own role" is enforced
 * by the shape of this DTO, not by a runtime check that could be missed.
 */
export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Asha Rao' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: '+91 90000 00000' })
  @IsOptional()
  @IsString()
  phone?: string;
}
