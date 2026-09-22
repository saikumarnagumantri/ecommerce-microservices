import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as jwt from 'jsonwebtoken';
import { JwtAuthGuard } from './jwt-auth.guard';

function contextWith(headers: Record<string, string>, request: any = {}) {
  request.headers = headers;
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  const OLD_ENV = process.env.JWT_SECRET;
  afterEach(() => {
    process.env.JWT_SECRET = OLD_ENV;
  });

  function guardWith(isPublic: boolean) {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(isPublic) } as unknown as Reflector;
    return new JwtAuthGuard(reflector);
  }

  it('lets a @Public() route through with no token', () => {
    const guard = guardWith(true);
    expect(guard.canActivate(contextWith({}))).toBe(true);
  });

  it('rejects a missing Authorization header', () => {
    const guard = guardWith(false);
    expect(() => guard.canActivate(contextWith({}))).toThrow(UnauthorizedException);
  });

  it('rejects when JWT_SECRET is not configured', () => {
    delete process.env.JWT_SECRET;
    const guard = guardWith(false);
    const ctx = contextWith({ authorization: 'Bearer whatever' });
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('rejects an invalid token', () => {
    process.env.JWT_SECRET = 'test-secret';
    const guard = guardWith(false);
    const ctx = contextWith({ authorization: 'Bearer not-a-real-token' });
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('accepts a valid token and attaches the user to the request', () => {
    process.env.JWT_SECRET = 'test-secret';
    const token = jwt.sign({ sub: 42, role: 'ADMIN', email: 'a@b.com' }, 'test-secret');
    const guard = guardWith(false);
    const request: any = {};
    const ctx = contextWith({ authorization: `Bearer ${token}` }, request);

    expect(guard.canActivate(ctx)).toBe(true);
    expect(request.user).toEqual({ id: 42, role: 'ADMIN', email: 'a@b.com' });
  });
});
