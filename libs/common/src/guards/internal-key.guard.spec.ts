import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { INTERNAL_KEY_HEADER } from '../constants';
import { InternalKeyGuard } from './internal-key.guard';

function contextWith(headers: Record<string, string>) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  } as unknown as ExecutionContext;
}

describe('InternalKeyGuard', () => {
  const OLD_ENV = process.env.INTERNAL_API_KEY;
  afterEach(() => {
    process.env.INTERNAL_API_KEY = OLD_ENV;
  });

  it('fails closed when no key is configured, even if the caller sends nothing', () => {
    delete process.env.INTERNAL_API_KEY;
    const guard = new InternalKeyGuard();
    expect(() => guard.canActivate(contextWith({}))).toThrow(UnauthorizedException);
  });

  it('rejects a missing header', () => {
    process.env.INTERNAL_API_KEY = 'secret-key';
    const guard = new InternalKeyGuard();
    expect(() => guard.canActivate(contextWith({}))).toThrow(UnauthorizedException);
  });

  it('rejects the wrong key', () => {
    process.env.INTERNAL_API_KEY = 'secret-key';
    const guard = new InternalKeyGuard();
    expect(() =>
      guard.canActivate(contextWith({ [INTERNAL_KEY_HEADER]: 'wrong' })),
    ).toThrow(UnauthorizedException);
  });

  it('accepts the correct key', () => {
    process.env.INTERNAL_API_KEY = 'secret-key';
    const guard = new InternalKeyGuard();
    expect(guard.canActivate(contextWith({ [INTERNAL_KEY_HEADER]: 'secret-key' }))).toBe(true);
  });
});
