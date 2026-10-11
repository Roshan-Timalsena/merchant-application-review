import { CanActivate, ExecutionContext, mixin, Type } from '@nestjs/common';
import { User } from '../../users/entities/user.entity';
import { UserRole } from '../../users/enums/user-role.enum';

export const RolesGuard = (...roles: UserRole[]): Type<CanActivate> => {
  class RolesGuardMixin implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
      if (roles.length === 0) {
        return true;
      }

      const request = context.switchToHttp().getRequest<{ user?: User }>();
      const user = request.user;
      if (!user) {
        return false;
      }

      return roles.includes(user.role);
    }
  }

  return mixin(RolesGuardMixin);
};
