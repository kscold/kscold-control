import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../../application/services/auth.service';
import { SessionVerifier } from '../../application/services/session-verifier.service';
import { IMPERSONATION_TOKEN_USE } from '../../../common/constants/impersonation';
import type { JwtTokenClaims } from '../../../common/types/jwt-request.type';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
    private readonly sessionVerifier: SessionVerifier,
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is required');
    }
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (request: { query?: Record<string, unknown> } | undefined) => {
          const token = request?.query?.token;
          return typeof token === 'string' ? token : null;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtTokenClaims) {
    const user = await this.authService.validateUser(payload.sub);
    if (!user) {
      throw new UnauthorizedException('유효하지 않은 토큰입니다.');
    }
    // 토큰을 받은 뒤 바뀐 역할도 2단계 인증 요구에 바로 반영한다.
    const session = await this.sessionVerifier.verifyClaims({
      ...payload,
      roles: user.roles?.map((role) => role.name) ?? [],
    });

    // PermissionsGuard를 위한 평탄화된 permissions 배열 추가
    const permissions = user.roles
      ? user.roles.flatMap((role) => role.permissions.map((p) => p.name))
      : [];

    const isImpersonation = payload.tokenUse === IMPERSONATION_TOKEN_USE;
    if (
      isImpersonation &&
      (!payload.impersonatedBy?.id ||
        !payload.impersonatedBy.email ||
        !payload.exp)
    ) {
      throw new UnauthorizedException(
        '사용자 미리보기 토큰이 올바르지 않습니다.',
      );
    }

    return {
      ...user,
      permissions,
      sessionId: session.id,
      ...(isImpersonation
        ? {
            impersonation: {
              sessionId: session.id,
              actorId: payload.impersonatedBy!.id,
              actorEmail: payload.impersonatedBy!.email,
              expiresAt: new Date(payload.exp! * 1000).toISOString(),
              readOnly: true as const,
            },
          }
        : {}),
    };
  }
}
