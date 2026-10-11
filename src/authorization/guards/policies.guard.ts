import {
  CanActivate,
  ExecutionContext,
  Injectable,
  mixin,
  Type,
} from '@nestjs/common';
import { User } from '../../users/entities/user.entity';
import { AppAbility, CaslAbilityFactory } from '../casl-ability.factory';

export type PolicyHandler = (ability: AppAbility) => boolean;

export const PoliciesGuard = (
  ...handlers: PolicyHandler[]
): Type<CanActivate> => {
  @Injectable()
  class PoliciesGuardMixin implements CanActivate {
    constructor(private readonly caslAbilityFactory: CaslAbilityFactory) {}

    canActivate(context: ExecutionContext): boolean {
      if (handlers.length === 0) {
        return true;
      }

      const request = context.switchToHttp().getRequest<{ user?: User }>();
      const user = request.user;
      if (!user) {
        return false;
      }

      const ability = this.caslAbilityFactory.createForUser(user);
      return handlers.every((handler) => handler(ability));
    }
  }

  return mixin(PoliciesGuardMixin);
};
