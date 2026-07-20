import { Injectable, Inject } from '@nestjs/common';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '../../domain/repositories/user.repository.interface';
import { PermissionExtractor } from '../../../common/utils/permission-extractor.util';

/**
 * 웹소켓 권한 확인 서비스
 * Application 계층 — 권한 확인 로직을 Presentation(Gateway)에서 분리
 * 권한/유저는 rbac 모듈의 책임이므로 이 서비스는 rbac이 소유하고,
 * terminal / claude-chat / openai-chat 게이트웨이가 RbacModule을 통해 주입받는다.
 */
@Injectable()
export class WsPermissionService {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {}

  async checkPermission(
    userId: string,
    requiredPermission: string,
  ): Promise<boolean> {
    if (!userId) return false;

    const userWithPermissions =
      await this.userRepository.findByIdWithRoles(userId);
    if (!userWithPermissions) return false;

    const permissions = PermissionExtractor.extractFromRoles(
      userWithPermissions.roles,
    );
    return permissions.includes(requiredPermission);
  }
}
