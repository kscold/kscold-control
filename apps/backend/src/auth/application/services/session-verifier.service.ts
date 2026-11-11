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

/** uuid 칸에 형식이 다른 값을 넘기면 DB 가 500 을 내므로 조회 전에 거른다. */
const SESSION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 접근 토큰이 가리키는 서버 세션이 살아 있는지 확인한다.
 * HTTP(JwtStrategy), 세 WebSocket 게이트웨이, 원격 데스크톱, 열린 연결의 재확인이 모두 이 한 곳을 거친다.
 */
@Injectable()
export class SessionVerifier {
  constructor(
    @Inject(AUTH_SESSION_REPOSITORY)
    private readonly sessions: IAuthSessionRepository,
    private readonly jwtService: JwtService,
  ) {}

  /** 서명을 이미 확인한 claim 의 세션을 확인한다. */
  async verifyClaims(claims: {
    sub: string;
    sid?: unknown;
  }): Promise<AuthSession> {
    const now = new Date();
    const session = await this.findActive(claims.sid, now);
    if (!session || session.userId !== claims.sub) {
      throw new UnauthorizedException(
        '로그인 세션이 끝났습니다. 다시 로그인해주세요.',
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

  /** 이미 열린 연결을 계속 둘지 정할 때 쓴다. 마지막 사용 시각은 바꾸지 않는다. */
  async isActive(sessionId: string): Promise<boolean> {
    return (await this.findActive(sessionId, new Date())) !== null;
  }

  /**
   * 미리보기 세션은 자기를 연 관리자 세션이 살아 있어야 쓸 수 있다.
   * 미리보기 대상은 관리자가 아니라 미리보기가 다시 미리보기를 열 수 없으므로 부모는 한 단계뿐이다.
   */
  private async findActive(
    sessionId: unknown,
    now: Date,
  ): Promise<AuthSession | null> {
    if (typeof sessionId !== 'string' || !SESSION_ID_PATTERN.test(sessionId)) {
      return null;
    }
    const session = await this.sessions.findById(sessionId);
    if (!session || !isSessionActive(session, now)) return null;
    if (session.parentSessionId) {
      const parent = await this.sessions.findById(session.parentSessionId);
      if (!parent || !isSessionActive(parent, now)) return null;
    }
    return session;
  }
}
