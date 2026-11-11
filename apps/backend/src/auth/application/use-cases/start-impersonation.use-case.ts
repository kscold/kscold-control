import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
import {
  AuthSessionService,
  type SessionClient,
} from '../services/auth-session.service';

/**
 * 최고 관리자가 다른 사용자의 권한 화면을 읽기 전용으로 점검한다.
 * 미리보기는 관리자 세션 아래의 자식 세션이라, 관리자가 로그아웃하면 함께 끊긴다.
 */
@Injectable()
export class StartImpersonationUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly authSessions: AuthSessionService,
  ) {}

  async execute(
    actor: JwtPayload,
    targetUserId: string,
    client: SessionClient,
  ) {
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

    const session = await this.authSessions.open(target.id, client, {
      parentSessionId: actor.sessionId,
      absoluteTtlMs: IMPERSONATION_TTL_SECONDS * 1000,
    });
    const roles = target.roles.map((role) => role.name);
    const permissions = PermissionExtractor.extractFromRoles(target.roles);
    const accessToken = this.authSessions.signAccessToken(
      {
        sub: target.id,
        email: target.email,
        roles,
        permissions,
        tokenUse: IMPERSONATION_TOKEN_USE,
        impersonatedBy: { id: actor.id, email: actor.email },
      },
      session,
    );

    return {
      accessToken,
      sessionId: session.id,
      expiresAt: session.expiresAt.toISOString(),
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
