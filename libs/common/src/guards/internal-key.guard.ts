import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { INTERNAL_KEY_HEADER } from '../constants';

/**
 * Rejects any request that does not carry the shared internal API key,
 * so a downstream service (products, inventory, cart, orders, ...) is
 * only reachable from the gateway or another trusted service, not
 * directly from the public internet.
 *
 * Adopted per-service once the gateway forwards the key (E6-1).
 * Fails closed: if INTERNAL_API_KEY is not set, every request is rejected
 * rather than silently allowed through.
 */
@Injectable()
export class InternalKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const provided = request.headers?.[INTERNAL_KEY_HEADER];
    const expected = process.env.INTERNAL_API_KEY;

    if (!expected) {
      throw new UnauthorizedException('Internal API key is not configured');
    }
    if (provided !== expected) {
      throw new UnauthorizedException('Invalid internal API key');
    }
    return true;
  }
}
