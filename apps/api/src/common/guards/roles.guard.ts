import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

/** Role hierarchy: higher roles inherit lower-role access where relevant. */
const ROLE_WEIGHT: Record<Role, number> = {
  USER: 0,
  THERAPIST: 1,
  CORPORATE_ADMIN: 1,
  ADMIN: 2,
  SUPER_ADMIN: 3,
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user) return false;
    if (required.includes(user.role)) return true;

    // ADMIN and SUPER_ADMIN can access any role-restricted endpoint below their weight
    const minRequired = Math.min(...required.map((r) => ROLE_WEIGHT[r]));
    return ROLE_WEIGHT[user.role as Role] > Math.max(minRequired, 1);
  }
}
