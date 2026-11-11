import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  extendedExpiry,
  isSessionActive,
  openingLifetime,
} from '../../domain/auth-session.policy';
import type {
  AuthSession,
  SessionAssurance,
} from '../../domain/entities/auth-session.entity';
import {
  AUTH_SESSION_REPOSITORY,
  type IAuthSessionRepository,
} from '../../domain/repositories/auth-session.repository.interface';
import { SessionConnectionRegistry } from './session-connection-registry.service';
import { PermissionExtractor } from '../../../common/utils/permission-extractor.util';
import type { User } from '../../../rbac/domain/entities/user.entity';
import type { AuthenticatedLogin } from '../dto/login-result';

export interface SessionClient {
  ip: string | null;
  userAgent: string | null;
}

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

function epochSeconds(date: Date): number {
  return Math.floor(date.getTime() / 1000);
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
    options: {
      parentSessionId?: string;
      absoluteTtlMs?: number;
      assurance?: SessionAssurance;
    } = {},
  ): Promise<AuthSession> {
    const now = new Date();
    return this.sessions.open({
      userId,
      parentSessionId: options.parentSessionId ?? null,
      ip: client.ip,
      userAgent: client.userAgent,
      assurance: options.assurance ?? 'password',
      createdAt: now,
      ...openingLifetime(now, options.absoluteTtlMs),
    });
  }

  async signIn(
    user: Pick<User, 'id' | 'email' | 'roles'>,
    client: SessionClient,
    assurance: SessionAssurance,
  ): Promise<AuthenticatedLogin> {
    const session = await this.open(user.id, client, { assurance });
    return this.authenticated(user, session);
  }

  /**
   * 로그인한 화면에서 2단계 인증을 켰을 때 새 세션을 열지 않고 그 세션을 mfa 로 올린다.
   * 다른 세션은 비밀번호만 거친 것이라 끊는다. 세션이 이미 끝났으면 null 이다.
   */
  async upgradeToMfa(
    user: Pick<User, 'id' | 'email' | 'roles'>,
    sessionId: string,
  ): Promise<AuthenticatedLogin | null> {
    const session = await this.sessions.findById(sessionId);
    if (
      !session ||
      session.userId !== user.id ||
      session.parentSessionId !== null ||
      !isSessionActive(session, new Date())
    ) {
      return null;
    }
    await this.sessions.upgradeToMfa(session.id);
    await this.revokeAllForUser(user.id, { id: user.id, sessionId });
    return this.authenticated(user, { ...session, assurance: 'mfa' });
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

  async revoke(sessionId: string): Promise<number> {
    const revoked = await this.sessions.revoke(sessionId, new Date());
    this.connections.closeSessions(revoked);
    return revoked.length;
  }

  /**
   * 본인이 자기 계정에 한 일이면 요청을 보낸 세션은 남긴다. 그 세션은 이미 비밀번호를 바꿀 만큼
   * 계정을 쥐고 있어 끊어도 막는 것이 없고, 방금 일을 마친 본인만 로그아웃된다.
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

  private authenticated(
    user: Pick<User, 'id' | 'email' | 'roles'>,
    session: AuthSession,
  ): AuthenticatedLogin {
    const signedIn = {
      id: user.id,
      email: user.email,
      roles: user.roles.map((role) => role.name),
      permissions: PermissionExtractor.extractFromRoles(user.roles),
    };
    const accessToken = this.signAccessToken(
      {
        sub: signedIn.id,
        email: signedIn.email,
        roles: signedIn.roles,
        permissions: signedIn.permissions,
      },
      session,
    );
    return { kind: 'authenticated', accessToken, user: signedIn };
  }

  /**
   * 토큰이 세션보다 오래 살지 않게 만료를 세션의 유휴 만료에 맞춘다.
   * `maxExp` 는 갱신해도 넘지 못하는 세션 절대 만료다.
   */
  signAccessToken(claims: AccessTokenClaims, session: AuthSession): string {
    const issuedAt = epochSeconds(new Date());
    const expiresAt = epochSeconds(session.expiresAt);
    return this.jwtService.sign(
      {
        ...claims,
        sid: session.id,
        iat: issuedAt,
        maxExp: epochSeconds(session.absoluteExpiresAt),
      },
      { expiresIn: Math.max(1, expiresAt - issuedAt) },
    );
  }
}
