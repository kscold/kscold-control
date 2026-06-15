import { Injectable, Inject } from '@nestjs/common';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '../../../rbac/domain/repositories/user.repository.interface';
import { PermissionExtractor } from '../../../common/utils/permission-extractor.util';

/**
 * WsPermissionService
 * Application Layer - 권한 확인 로직을 Presentation(Gateway)에서 분리
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
