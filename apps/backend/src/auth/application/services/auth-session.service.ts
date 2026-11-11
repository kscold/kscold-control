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

export interface SessionClient {
  ip: string | null;
  userAgent: string | null;
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

  revoke(sessionId: string): Promise<void> {
    return this.sessions.revoke(sessionId, new Date());
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
