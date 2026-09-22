import * as jwt from 'jsonwebtoken';
import { Request } from 'express';
import { matchRoute, RouteRule } from './gateway.routes';
import { GatewayHttpError } from './gateway-http-error';

export interface GatewayCheckResult {
  route: RouteRule;
}

/**
 * The gateway's own auth check, run before a request is ever proxied
 * downstream: unauthenticated and wrong-role requests fail fast here
 * with 401/403, at the one entry point (E6-2). Route-group auth level
 * comes from gateway.routes.ts — a full passthrough proxy has no single
 * controller method to hang @Public()/@Roles() decorators off.
 */
export function checkAuth(req: Request, apiPath: string): GatewayCheckResult {
  const route = matchRoute(apiPath || '/');
  if (!route) {
    throw new GatewayHttpError(404, 'Not Found', `No route configured for ${apiPath}`);
  }

  if (route.auth === 'public') {
    return { route };
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new GatewayHttpError(401, 'Unauthorized', 'Missing bearer token');
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new GatewayHttpError(401, 'Unauthorized', 'Auth is not configured');
  }

  const token = authHeader.slice('Bearer '.length).trim();
  let payload: jwt.JwtPayload;
  try {
    payload = jwt.verify(token, secret) as jwt.JwtPayload;
  } catch {
    throw new GatewayHttpError(401, 'Unauthorized', 'Invalid or expired token');
  }

  (req as Request & { user?: unknown }).user = {
    id: Number(payload.sub),
    role: payload.role,
    email: payload.email,
  };

  if (route.auth === 'admin' && payload.role !== 'ADMIN') {
    throw new GatewayHttpError(403, 'Forbidden', 'Insufficient role for this action');
  }

  return { route };
}
