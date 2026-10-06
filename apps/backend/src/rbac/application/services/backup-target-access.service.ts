import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PERMISSIONS } from '../../../common/constants/permissions';
import type { JwtPayload } from '../../../common/types/jwt-request.type';
import { PermissionExtractor } from '../../../common/utils/permission-extractor.util';
import { isGlobalAdministrator } from '../../../common/utils/role-access.util';
import {
  BACKUP_TARGET_ACCESS_REPOSITORY,
  type IBackupTargetAccessRepository,
} from '../../domain/repositories/backup-target-access.repository.interface';
import {
  USER_REPOSITORY,
  type IUserRepository,
} from '../../domain/repositories/user.repository.interface';

/** 열람 범위를 판단하는 데 필요한 사용자 정보 */
export type BackupViewer = Pick<JwtPayload, 'id' | 'roles' | 'permissions'>;

/**
 * 백업 대상 열람 범위
 *
 * 백업 조회 권한(backup:read)은 "백업 화면을 쓸 수 있는가"만 정하고,
 * "어느 대상을 볼 수 있는가"는 여기서 정한다.
 * - 전역 관리자, 백업 관리 권한(backup:manage) 보유자: 전체
 * - 그 밖의 조회 권한 보유자: 배정받은 대상만
 */
@Injectable()
export class BackupTargetAccessService {
  constructor(
    @Inject(BACKUP_TARGET_ACCESS_REPOSITORY)
    private readonly repository: IBackupTargetAccessRepository,
    @Inject(USER_REPOSITORY)
    private readonly users: IUserRepository,
  ) {}

  /** 배정 없이 모든 대상을 볼 수 있는 사용자인지 */
  hasFullScope(viewer: Pick<BackupViewer, 'roles' | 'permissions'>): boolean {
    return (
      isGlobalAdministrator(viewer.roles) ||
      viewer.permissions.includes(PERMISSIONS.BACKUP_MANAGE)
    );
  }

  /** 볼 수 있는 대상 id 를 돌려준다. 전체를 볼 수 있으면 null 이다. */
  async resolveVisibleTargetIds(
    viewer: BackupViewer,
  ): Promise<Set<string> | null> {
    if (this.hasFullScope(viewer)) {
      return null;
    }
    return new Set(await this.repository.findTargetIdsByUserId(viewer.id));
  }

  async assertCanView(viewer: BackupViewer, targetId: string): Promise<void> {
    const visible = await this.resolveVisibleTargetIds(viewer);
    if (visible !== null && !visible.has(targetId)) {
      throw new ForbiddenException('이 백업 대상을 볼 권한이 없습니다.');
    }
  }

  async listAccessMatrix() {
    const [targets, assignments] = await Promise.all([
      this.repository.findTargets(),
      this.repository.findAllAssignments(),
    ]);
    return { targets, assignments };
  }

  getUserTargetIds(userId: string): Promise<string[]> {
    return this.repository.findTargetIdsByUserId(userId);
  }

  async replaceUserTargets(
    userId: string,
    requestedTargetIds: string[],
    actorId: string,
  ) {
    const user = await this.users.findByIdWithRoles(userId);
    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    const permissions = PermissionExtractor.extractFromRoles(user.roles ?? []);
    if (this.hasFullScope({ roles: user.roles ?? [], permissions })) {
      throw new BadRequestException(
        '이 사용자는 모든 백업 대상을 볼 수 있어 범위를 따로 정하지 않습니다.',
      );
    }

    const targetIds = [...new Set(requestedTargetIds)].sort();
    // 조회 권한이 없는 사용자에게 대상을 배정해도 화면에 나타나지 않으므로 먼저 알려준다.
    if (
      targetIds.length > 0 &&
      !permissions.includes(PERMISSIONS.BACKUP_READ)
    ) {
      throw new BadRequestException(
        '이 사용자의 역할에는 백업 조회 권한이 없습니다. 역할을 먼저 지정하세요.',
      );
    }

    const availableIds = new Set(
      (await this.repository.findTargets()).map((target) => target.id),
    );
    if (targetIds.some((targetId) => !availableIds.has(targetId))) {
      throw new BadRequestException('유효하지 않은 백업 대상입니다.');
    }

    await this.repository.replaceForUser(userId, targetIds, actorId);
    return { userId, targetIds };
  }
}
