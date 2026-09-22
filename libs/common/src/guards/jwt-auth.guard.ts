import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as jwt from 'jsonwebtoken';
import { IS_PUBLIC_KEY } from '../constants';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

/**
 * Verifies the `Authorization: Bearer <token>` header and attaches the
 * decoded identity to `request.user`. Routes and controllers marked
 * with @Public() are let through without a token.
 *
 * Adopted by the gateway in E6-2, once the users service issues tokens (E1-2).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers?.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new UnauthorizedException('Auth is not configured');
    }

    const token = authHeader.slice('Bearer '.length).trim();
    try {
      const payload = jwt.verify(token, secret) as {
        sub: number | string;
        role: string;
        email?: string;
      };
      const user: AuthenticatedUser = {
        id: Number(payload.sub),
        role: payload.role as AuthenticatedUser['role'],
        email: payload.email,
      };
      request.user = user;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
