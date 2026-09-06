import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isGlobalAdministrator } from '../../../common/utils/role-access.util';
import type { JwtPayload } from '../../../common/types/jwt-request.type';
import {
  KEY_MANAGEMENT_TARGET_ACCESS_REPOSITORY,
  IKeyManagementTargetAccessRepository,
} from '../../domain/repositories/key-management-target-access.repository.interface';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '../../domain/repositories/user.repository.interface';

@Injectable()
export class KeyManagementTargetAccessService {
  constructor(
    @Inject(KEY_MANAGEMENT_TARGET_ACCESS_REPOSITORY)
    private readonly repository: IKeyManagementTargetAccessRepository,
    @Inject(USER_REPOSITORY)
    private readonly users: IUserRepository,
  ) {}

  async getAuthorizedTargetIds(
    user: Pick<JwtPayload, 'id' | 'roles'>,
  ): Promise<string[]> {
    const targets = await this.repository.findEnabledTargets();
    if (isGlobalAdministrator(user.roles)) {
      return targets.map((target) => target.id);
    }

    const granted = new Set(
      await this.repository.findTargetIdsByUserId(user.id),
    );
    return targets
      .filter((target) => granted.has(target.id))
      .map((target) => target.id);
  }

  async assertCanAccess(
    user: Pick<JwtPayload, 'id' | 'roles'>,
    targetId: string,
  ): Promise<void> {
    const targets = await this.repository.findEnabledTargets();
    if (!targets.some((target) => target.id === targetId)) {
      throw new NotFoundException('지원하지 않는 키 관리 대상입니다.');
    }
    if (isGlobalAdministrator(user.roles)) return;

    const targetIds = await this.repository.findTargetIdsByUserId(user.id);
    if (!targetIds.includes(targetId)) {
      throw new ForbiddenException('이 운영 키 대상에 접근할 권한이 없습니다.');
    }
  }

  async listAccessMatrix() {
    const [targets, assignments] = await Promise.all([
      this.repository.findEnabledTargets(),
      this.repository.findAllAssignments(),
    ]);
    return { targets, assignments };
  }

  async getUserTargetIds(userId: string): Promise<string[]> {
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
    if (isGlobalAdministrator(user.roles)) {
      throw new BadRequestException(
        '전역 관리자는 모든 운영 키 대상에 자동으로 접근합니다.',
      );
    }

    const targetIds = [...new Set(requestedTargetIds)].sort();
    const targets = await this.repository.findEnabledTargets();
    const availableIds = new Set(targets.map((target) => target.id));
    if (targetIds.some((targetId) => !availableIds.has(targetId))) {
      throw new BadRequestException('유효하지 않은 운영 키 대상입니다.');
    }

    await this.repository.replaceForUser(userId, targetIds, actorId);
    return { userId, targetIds };
  }

  async ensureDefaultTarget(userId: string, actorId: string): Promise<void> {
    const current = await this.repository.findTargetIdsByUserId(userId);
    if (current.length > 0) return;

    const targets = await this.repository.findEnabledTargets();
    const defaultTarget =
      targets.find((target) => target.id === 'gole-production') ?? targets[0];
    if (!defaultTarget) return;

    await this.repository.replaceForUser(userId, [defaultTarget.id], actorId);
  }
}
