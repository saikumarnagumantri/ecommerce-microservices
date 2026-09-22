import { INestApplication } from '@nestjs/common';
import helmet from 'helmet';
import { AllExceptionsFilter } from '../filters/all-exceptions.filter';
import { buildValidationPipe, ValidationPipeOptions } from '../pipes/validation-pipe.factory';

/**
 * Wires the cross-cutting pieces every service should have from boot:
 * consistent validation, a consistent error shape, and baseline security
 * response headers. Call this once in each service's main.ts, right after
 * `NestFactory.create`.
 *
 * Pass `{ strict: true }` once that service's DTOs carry class-validator
 * decorators (see ValidationPipeOptions) to start rejecting undeclared
 * fields; left off by default so this doesn't break existing endpoints
 * whose DTOs are Swagger-only today.
 *
 * Auth (JwtAuthGuard/RolesGuard) and InternalKeyGuard are deliberately not
 * included here — they go on once there is something to authenticate
 * against (users service, E1) and a gateway to trust (E6).
 *
 * helmet's default Content-Security-Policy is meant for HTML-serving apps
 * and breaks the inline script/style swagger-ui-express injects into each
 * service's own `/api` docs page, so it's left off here; every other
 * helmet default (nosniff, frameguard, HSTS, referrer-policy, etc.) still
 * applies. crossOriginResourcePolicy is relaxed to `cross-origin` because
 * product-image's static media is deliberately fetched cross-origin by the
 * mobile app and admin-web.
 */
export function applyCommonGlobals(
  app: INestApplication,
  validation: ValidationPipeOptions = {},
): void {
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.useGlobalPipes(buildValidationPipe(validation));
  app.useGlobalFilters(new AllExceptionsFilter());
}
