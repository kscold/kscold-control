import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import {
  IMPERSONATION_TOKEN_USE,
  IMPERSONATION_TTL_SECONDS,
} from '../../../common/constants/impersonation';
import type { JwtPayload } from '../../../common/types/jwt-request.type';
import { PermissionExtractor } from '../../../common/utils/permission-extractor.util';
import { isGlobalAdministrator } from '../../../common/utils/role-access.util';
import {
  type IUserRepository,
  USER_REPOSITORY,
} from '../../../rbac/domain/repositories/user.repository.interface';

/** 최고 관리자가 다른 사용자의 권한 화면을 읽기 전용으로 점검한다. */
@Injectable()
export class StartImpersonationUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly jwtService: JwtService,
  ) {}

  async execute(actor: JwtPayload, targetUserId: string) {
    if (!isGlobalAdministrator(actor.roles)) {
      throw new ForbiddenException(
        '최고 관리자만 사용자 화면을 미리 볼 수 있습니다.',
      );
    }
    if (actor.id === targetUserId) {
      throw new BadRequestException('현재 계정은 미리보기 대상이 아닙니다.');
    }

    const target = await this.userRepository.findByIdWithRoles(targetUserId);
    if (!target) throw new NotFoundException('사용자를 찾을 수 없습니다.');
    if (isGlobalAdministrator(target.roles)) {
      throw new ForbiddenException('관리자 계정은 미리 볼 수 없습니다.');
    }

    const sessionId = randomUUID();
    const expiresAt = new Date(
      Date.now() + IMPERSONATION_TTL_SECONDS * 1000,
    ).toISOString();
    const roles = target.roles.map((role) => role.name);
    const permissions = PermissionExtractor.extractFromRoles(target.roles);
    const accessToken = this.jwtService.sign(
      {
        sub: target.id,
        email: target.email,
        roles,
        permissions,
        tokenUse: IMPERSONATION_TOKEN_USE,
        impersonatedBy: { id: actor.id, email: actor.email },
        jti: sessionId,
      },
      { expiresIn: IMPERSONATION_TTL_SECONDS },
    );

    return {
      accessToken,
      sessionId,
      expiresAt,
      readOnly: true as const,
      user: {
        id: target.id,
        email: target.email,
        roles,
        permissions,
      },
    };
  }
}
