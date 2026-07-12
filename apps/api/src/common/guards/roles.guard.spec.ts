import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { RolesGuard } from './roles.guard';

function contextWithUser(role: Role | null): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user: role ? { id: 'u1', email: 'a@b.c', role } : undefined }),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const make = (required?: Role[]) => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(required),
    } as unknown as Reflector;
    return new RolesGuard(reflector);
  };

  it('allows when no roles are required', () => {
    expect(make(undefined).canActivate(contextWithUser(Role.USER))).toBe(true);
  });

  it('allows a user with the exact required role', () => {
    expect(make([Role.THERAPIST]).canActivate(contextWithUser(Role.THERAPIST))).toBe(true);
  });

  it('denies a user without the required role', () => {
    expect(make([Role.THERAPIST]).canActivate(contextWithUser(Role.USER))).toBe(false);
  });

  it('lets ADMIN access THERAPIST endpoints via hierarchy', () => {
    expect(make([Role.THERAPIST]).canActivate(contextWithUser(Role.ADMIN))).toBe(true);
  });

  it('lets SUPER_ADMIN access ADMIN endpoints', () => {
    expect(make([Role.ADMIN]).canActivate(contextWithUser(Role.SUPER_ADMIN))).toBe(true);
  });

  it('denies ADMIN on SUPER_ADMIN-only endpoints', () => {
    expect(make([Role.SUPER_ADMIN]).canActivate(contextWithUser(Role.ADMIN))).toBe(false);
  });

  it('denies unauthenticated requests', () => {
    expect(make([Role.USER]).canActivate(contextWithUser(null))).toBe(false);
  });
});
