import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  isSessionActive,
  SESSION_TOUCH_INTERVAL_MS,
} from '../../domain/auth-session.policy';
import type { AuthSession } from '../../domain/entities/auth-session.entity';
import {
  AUTH_SESSION_REPOSITORY,
  type IAuthSessionRepository,
} from '../../domain/repositories/auth-session.repository.interface';
import type { SocketJwtPayload } from '../../../common/types/authenticated-socket.type';
import { MfaConfig } from '../../mfa/application/mfa-config';

/** uuid 칸에 형식이 다른 값을 넘기면 DB 가 500 을 내므로 조회 전에 거른다. */
const SESSION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 접근 토큰이 가리키는 서버 세션이 살아 있는지 확인한다. */
@Injectable()
export class SessionVerifier {
  constructor(
    @Inject(AUTH_SESSION_REPOSITORY)
    private readonly sessions: IAuthSessionRepository,
    private readonly jwtService: JwtService,
    private readonly mfa: MfaConfig,
  ) {}

  /**
   * 서명을 이미 확인한 claim 의 세션을 확인한다.
   * `roles` 는 2단계 인증이 필요한 계정인지 가르는 데 쓴다. HTTP 요청은 DB 의 현재 역할을 넣는다.
   */
  async verifyClaims(claims: {
    sub: string;
    sid?: unknown;
    roles?: unknown;
  }): Promise<AuthSession> {
    const now = new Date();
    const session = await this.findActive(claims.sid, now);
    if (!session || session.userId !== claims.sub) {
      throw new UnauthorizedException(
        '로그인 세션이 끝났습니다. 다시 로그인해주세요.',
      );
    }
    // 미리보기 세션은 이미 확인한 관리자 세션 아래에서만 열린다.
    if (
      session.assurance !== 'mfa' &&
      !session.parentSessionId &&
      this.mfa.requiresMfa(
        Array.isArray(claims.roles) ? (claims.roles as string[]) : [],
      )
    ) {
      throw new UnauthorizedException(
        '이 계정은 2단계 인증을 거쳐야 합니다. 다시 로그인해주세요.',
      );
    }
    if (
      now.getTime() - session.lastSeenAt.getTime() >=
      SESSION_TOUCH_INTERVAL_MS
    ) {
      await this.sessions.touch(session.id, now);
    }
    return session;
  }

  /** Passport 를 거치지 않는 소켓 연결의 토큰을 서명과 세션까지 확인한다. */
  async verifyToken(token: string): Promise<SocketJwtPayload> {
    let claims: SocketJwtPayload;
    try {
      claims = this.jwtService.verify<SocketJwtPayload>(token);
    } catch {
      throw new UnauthorizedException('유효하지 않은 토큰입니다.');
    }
    await this.verifyClaims(claims);
    return claims;
  }

  /** 열린 연결의 재확인은 사용자 활동이 아니므로 마지막 사용 시각을 바꾸지 않는다. */
  async isActive(sessionId: string): Promise<boolean> {
    return (await this.findActive(sessionId, new Date())) !== null;
  }

  private async findActive(
    sessionId: unknown,
    now: Date,
  ): Promise<AuthSession | null> {
    if (typeof sessionId !== 'string' || !SESSION_ID_PATTERN.test(sessionId)) {
      return null;
    }
    const session = await this.sessions.findById(sessionId);
    if (!session || !isSessionActive(session, now)) return null;
    if (
      session.parentSessionId &&
      !(await this.findActive(session.parentSessionId, now))
    ) {
      return null;
    }
    return session;
  }
}
