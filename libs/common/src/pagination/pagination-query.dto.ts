import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Common `?page&limit` query shape for list endpoints. Deliberately has no
 * Swagger decorators, so this library stays usable by services that don't
 * depend on @nestjs/swagger; a controller can re-declare @ApiPropertyOptional
 * on a subclass if it needs the schema documented.
 */
export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}
