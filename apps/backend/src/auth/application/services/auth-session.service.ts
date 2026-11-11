import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  extendedExpiry,
  isSessionActive,
  openingLifetime,
} from '../../domain/auth-session.policy';
import type { AuthSession } from '../../domain/entities/auth-session.entity';
import {
  AUTH_SESSION_REPOSITORY,
  type IAuthSessionRepository,
} from '../../domain/repositories/auth-session.repository.interface';
import { SessionConnectionRegistry } from './session-connection-registry.service';

export interface SessionClient {
  ip: string | null;
  userAgent: string | null;
}

/** 요청을 보낸 사용자와 그 요청의 서버 세션 */
export interface SessionActor {
  id: string;
  sessionId: string;
}

export interface AccessTokenClaims {
  sub: string;
  email: string;
  roles: string[];
  permissions: string[];
  [claim: string]: unknown;
}

@Injectable()
export class AuthSessionService {
  constructor(
    @Inject(AUTH_SESSION_REPOSITORY)
    private readonly sessions: IAuthSessionRepository,
    private readonly jwtService: JwtService,
    private readonly connections: SessionConnectionRegistry,
  ) {}

  open(
    userId: string,
    client: SessionClient,
    options: { parentSessionId?: string; absoluteTtlMs?: number } = {},
  ): Promise<AuthSession> {
    const now = new Date();
    return this.sessions.open({
      userId,
      parentSessionId: options.parentSessionId ?? null,
      ip: client.ip,
      userAgent: client.userAgent,
      assurance: 'password',
      createdAt: now,
      ...openingLifetime(now, options.absoluteTtlMs),
    });
  }

  async extend(sessionId: string): Promise<AuthSession> {
    const session = await this.sessions.findById(sessionId);
    const now = new Date();
    if (!session || !isSessionActive(session, now)) {
      throw new UnauthorizedException(
        '로그인 세션이 끝났습니다. 다시 로그인해주세요.',
      );
    }
    const expiresAt = extendedExpiry(session, now);
    await this.sessions.extend(session.id, expiresAt);
    return { ...session, expiresAt };
  }

  /** 세션과 그 미리보기 세션을 끊고, 그 세션들로 열린 연결을 바로 닫는다. */
  async revoke(sessionId: string): Promise<number> {
    const revoked = await this.sessions.revoke(sessionId, new Date());
    this.connections.closeSessions(revoked);
    return revoked.length;
  }

  /**
   * 사용자의 세션을 모두 끊는다. 본인이 자기 계정에 한 일이면 그 요청을 보낸 세션은 남긴다.
   * 그 세션은 비밀번호를 바꿀 수 있을 만큼 이미 계정을 쥐고 있어 끊어도 막는 것이 없고,
   * 끊으면 방금 일을 마친 본인만 로그아웃된다.
   */
  async revokeAllForUser(
    userId: string,
    actor?: SessionActor,
  ): Promise<number> {
    const revoked = await this.sessions.revokeForUser(
      userId,
      new Date(),
      actor?.id === userId ? actor.sessionId : null,
    );
    this.connections.closeSessions(revoked);
    return revoked.length;
  }

  /** 토큰이 세션보다 오래 살지 않게 만료를 세션의 유휴 만료에 맞춘다. */
  signAccessToken(claims: AccessTokenClaims, session: AuthSession): string {
    const remainingSeconds = Math.floor(
      (session.expiresAt.getTime() - Date.now()) / 1000,
    );
    return this.jwtService.sign(
      { ...claims, sid: session.id },
      { expiresIn: Math.max(1, remainingSeconds) },
    );
  }
}
