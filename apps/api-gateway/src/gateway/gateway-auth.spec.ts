import * as jwt from 'jsonwebtoken';
import { Request } from 'express';
import { checkAuth } from './gateway-auth';
import { GatewayHttpError } from './gateway-http-error';

function fakeReq(headers: Record<string, string> = {}, path = '/orders'): Request {
  return { headers, path } as unknown as Request;
}

describe('checkAuth', () => {
  const OLD_SECRET = process.env.JWT_SECRET;
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret';
  });
  afterEach(() => {
    process.env.JWT_SECRET = OLD_SECRET;
  });

  it('lets a public route through with no token', () => {
    const result = checkAuth(fakeReq({}, '/products'), '/products');
    expect(result.route.auth).toBe('public');
  });

  it('rejects an unconfigured path with 404', () => {
    expect(() => checkAuth(fakeReq({}, '/nonexistent'), '/nonexistent')).toThrow(GatewayHttpError);
  });

  it('rejects a protected route with no token (401)', () => {
    try {
      checkAuth(fakeReq({}, '/orders'), '/orders');
      fail('expected to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(GatewayHttpError);
      expect((err as GatewayHttpError).statusCode).toBe(401);
    }
  });

  it('accepts a valid token for an authenticated route and attaches req.user', () => {
    const token = jwt.sign({ sub: 2, role: 'CUSTOMER', email: 'a@b.com' }, 'test-secret');
    const req = fakeReq({ authorization: `Bearer ${token}` }, '/orders');

    const result = checkAuth(req, '/orders');

    expect(result.route.auth).toBe('authenticated');
    expect((req as any).user).toEqual({ id: 2, role: 'CUSTOMER', email: 'a@b.com' });
  });

  it('rejects a customer token on an admin route (403)', () => {
    const token = jwt.sign({ sub: 2, role: 'CUSTOMER' }, 'test-secret');
    const req = fakeReq({ authorization: `Bearer ${token}` }, '/admin/orders');

    try {
      checkAuth(req, '/admin/orders');
      fail('expected to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(GatewayHttpError);
      expect((err as GatewayHttpError).statusCode).toBe(403);
    }
  });

  it('accepts an admin token on an admin route', () => {
    const token = jwt.sign({ sub: 1, role: 'ADMIN' }, 'test-secret');
    const req = fakeReq({ authorization: `Bearer ${token}` }, '/admin/orders');

    expect(() => checkAuth(req, '/admin/orders')).not.toThrow();
  });
});
