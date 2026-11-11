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

/**
 * 접근 토큰이 가리키는 서버 세션이 살아 있는지 확인한다.
 * HTTP(JwtStrategy)와 세 WebSocket 게이트웨이가 모두 이 한 곳을 거친다.
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
    const session =
      typeof claims.sid === 'string'
        ? await this.sessions.findById(claims.sid)
        : null;
    const now = new Date();
    if (
      !session ||
      session.userId !== claims.sub ||
      !isSessionActive(session, now)
    ) {
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
}
