import { BadRequestException, ValidationError, ValidationPipe } from '@nestjs/common';

/** Flattens class-validator's nested error tree into "field: message" strings. */
function flatten(errors: ValidationError[], parent = ''): string[] {
  return errors.flatMap((e) => {
    const field = parent ? `${parent}.${e.property}` : e.property;
    const ownMessages = e.constraints ? Object.values(e.constraints) : [];
    const nestedMessages = e.children?.length ? flatten(e.children, field) : [];
    return [...ownMessages.map((m) => `${field}: ${m}`), ...nestedMessages];
  });
}

export interface ValidationPipeOptions {
  /**
   * Strip fields with no class-validator decorator, and reject the
   * request outright if any were present. Off by default: none of the
   * DTOs in this codebase carry class-validator decorators yet (only
   * @ApiProperty for Swagger), so turning this on unconditionally would
   * mark every field "unknown" and break every existing endpoint that
   * takes a body. Pass `strict: true` once a service's DTOs have been
   * decorated (starting with the DTOs each story in E1/E2/E5 introduces).
   */
  strict?: boolean;
}

/**
 * The validation pipe every service should register globally. Always
 * converts primitives to their DTO types and reports every failing field
 * at once instead of just the first; whitelisting is opt-in per service
 * via `{ strict: true }` (see ValidationPipeOptions).
 */
export function buildValidationPipe(options: ValidationPipeOptions = {}): ValidationPipe {
  const strict = options.strict ?? false;
  return new ValidationPipe({
    whitelist: strict,
    forbidNonWhitelisted: strict,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
    exceptionFactory: (errors) => new BadRequestException(flatten(errors)),
  });
}
