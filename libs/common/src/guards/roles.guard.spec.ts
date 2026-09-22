import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../enums/role.enum';
import { RolesGuard } from './roles.guard';

function contextWithUser(user: any) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

function guardRequiring(roles: Role[] | undefined) {
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(roles) } as unknown as Reflector;
  return new RolesGuard(reflector);
}

describe('RolesGuard', () => {
  it('allows any authenticated user when no roles are required', () => {
    const guard = guardRequiring(undefined);
    expect(guard.canActivate(contextWithUser({ role: Role.CUSTOMER }))).toBe(true);
  });

  it('allows a user whose role is in the required list', () => {
    const guard = guardRequiring([Role.ADMIN]);
    expect(guard.canActivate(contextWithUser({ role: Role.ADMIN }))).toBe(true);
  });

  it('rejects a user whose role is not in the required list', () => {
    const guard = guardRequiring([Role.ADMIN]);
    expect(() => guard.canActivate(contextWithUser({ role: Role.CUSTOMER }))).toThrow(
      ForbiddenException,
    );
  });

  it('rejects when there is no user on the request', () => {
    const guard = guardRequiring([Role.ADMIN]);
    expect(() => guard.canActivate(contextWithUser(undefined))).toThrow(ForbiddenException);
  });
});
