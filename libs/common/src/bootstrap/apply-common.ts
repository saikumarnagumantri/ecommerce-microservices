import { INestApplication } from '@nestjs/common';
import { AllExceptionsFilter } from '../filters/all-exceptions.filter';
import { buildValidationPipe, ValidationPipeOptions } from '../pipes/validation-pipe.factory';

/**
 * Wires the cross-cutting pieces every service should have from boot:
 * consistent validation and a consistent error shape. Call this once in
 * each service's main.ts, right after `NestFactory.create`.
 *
 * Pass `{ strict: true }` once that service's DTOs carry class-validator
 * decorators (see ValidationPipeOptions) to start rejecting undeclared
 * fields; left off by default so this doesn't break existing endpoints
 * whose DTOs are Swagger-only today.
 *
 * Auth (JwtAuthGuard/RolesGuard) and InternalKeyGuard are deliberately not
 * included here — they go on once there is something to authenticate
 * against (users service, E1) and a gateway to trust (E6).
 */
export function applyCommonGlobals(
  app: INestApplication,
  validation: ValidationPipeOptions = {},
): void {
  app.useGlobalPipes(buildValidationPipe(validation));
  app.useGlobalFilters(new AllExceptionsFilter());
}
