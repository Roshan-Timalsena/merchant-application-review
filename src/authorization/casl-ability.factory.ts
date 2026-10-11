import {
  AbilityBuilder,
  createMongoAbility,
  InferSubjects,
  MongoAbility,
} from '@casl/ability';
import { Injectable } from '@nestjs/common';
import { MerchantApplication } from '../merchant-applications/entities/merchant-application.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';

export type Actions =
  | 'manage'
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'submit'
  | 'assign'
  | 'approve'
  | 'requestInfo';

export type Subjects = InferSubjects<typeof MerchantApplication> | 'all';

export type AppAbility = MongoAbility<[Actions, Subjects]>;

@Injectable()
export class CaslAbilityFactory {
  createForUser(user: User): AppAbility {
    const { can, cannot, build } = new AbilityBuilder<AppAbility>(
      createMongoAbility,
    );

    if (user.role === UserRole.ADMIN) {
      can('manage', 'all');
    } else if (user.role === UserRole.REVIEWER) {
      can('read', MerchantApplication, {
        assignedReviewerId: user.id,
      });
      can('read', MerchantApplication, {
        createdById: user.id,
      });
      can('approve', MerchantApplication, {
        assignedReviewerId: user.id,
      });
      can('requestInfo', MerchantApplication, {
        assignedReviewerId: user.id,
      });
      cannot('create', MerchantApplication);
      cannot('assign', MerchantApplication);
    } else if (user.role === UserRole.SALES) {
      can('create', MerchantApplication);
      can('read', MerchantApplication, { createdById: user.id });
      can('update', MerchantApplication, { createdById: user.id });
      can('submit', MerchantApplication, { createdById: user.id });
      cannot('approve', MerchantApplication);
      cannot('requestInfo', MerchantApplication);
      cannot('assign', MerchantApplication);
    }

    return build();
  }
}
