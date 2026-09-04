import { Injectable } from '@nestjs/common';
import { PermissionExtractor } from '../../../common/utils/permission-extractor.util';
import type { User } from '../../../rbac/domain/entities/user.entity';
import type { ImpersonationContext } from '../../../common/types/jwt-request.type';

type AuthenticatedUser = User & {
  impersonation?: ImpersonationContext;
};

/** 현재 로그인 사용자 정보 조회 */
@Injectable()
export class GetMeUseCase {
  execute(user: AuthenticatedUser) {
    return {
      id: user.id,
      email: user.email,
      roles: user.roles?.map((r) => r.name) ?? [],
      permissions: PermissionExtractor.extractFromRoles(user.roles ?? []),
      ...(user.impersonation ? { impersonation: user.impersonation } : {}),
    };
  }
}
