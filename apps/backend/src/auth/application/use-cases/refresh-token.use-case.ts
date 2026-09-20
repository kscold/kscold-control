import { ForbiddenException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PermissionExtractor } from '../../../common/utils/permission-extractor.util';
import type { User } from '../../../rbac/domain/entities/user.entity';
import type { ImpersonationContext } from '../../../common/types/jwt-request.type';

type AuthenticatedUser = User & {
  impersonation?: ImpersonationContext;
};

/**
 * 접근 토큰 갱신 유스케이스
 *
 * 아직 유효한 토큰을 제시한 사용자에게 같은 권한으로 새 토큰을 발급한다.
 * 토큰이 고정 만료(7일)만 가지고 있어, 대용량 소스 동기화처럼 오래 걸리는
 * 작업 도중 만료되면 업로드와 세션이 함께 끊기는 문제가 있었다.
 * (실제로 발급 후 정확히 7일이 되는 순간 업로드 배치가 401로 실패했다)
 * 만료가 임박하면 화면이 이 유스케이스로 토큰을 미리 바꿔 끊김을 없앤다.
 */
@Injectable()
export class RefreshTokenUseCase {
  constructor(private readonly jwtService: JwtService) {}

  execute(user: AuthenticatedUser) {
    // 사용자 미리보기(임퍼스네이션) 토큰은 짧은 수명이 곧 보안 장치이므로 갱신하지 않는다.
    if (user.impersonation) {
      throw new ForbiddenException(
        '사용자 미리보기 세션은 갱신할 수 없습니다.',
      );
    }

    const roles = user.roles?.map((role) => role.name) ?? [];
    const permissions = PermissionExtractor.extractFromRoles(user.roles ?? []);

    // 로그인과 동일한 형태로 서명해야 기존 토큰과 해석이 어긋나지 않는다.
    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      roles,
      permissions,
    });

    return {
      accessToken,
      user: { id: user.id, email: user.email, roles, permissions },
    };
  }
}
