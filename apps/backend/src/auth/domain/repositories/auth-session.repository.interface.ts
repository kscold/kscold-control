import type {
  AuthSession,
  SessionAssurance,
} from '../entities/auth-session.entity';

export const AUTH_SESSION_REPOSITORY = Symbol('AUTH_SESSION_REPOSITORY');

export interface OpenAuthSessionInput {
  userId: string;
  parentSessionId: string | null;
  ip: string | null;
  userAgent: string | null;
  assurance: SessionAssurance;
  createdAt: Date;
  expiresAt: Date;
  absoluteExpiresAt: Date;
}

export interface IAuthSessionRepository {
  open(input: OpenAuthSessionInput): Promise<AuthSession>;
  findById(id: string): Promise<AuthSession | null>;
  extend(id: string, expiresAt: Date): Promise<void>;
  touch(id: string, at: Date): Promise<void>;
  /** 세션과 그 세션이 연 미리보기 세션을 함께 끊는다. 이미 끊긴 행의 시각은 바꾸지 않는다. */
  revoke(id: string, at: Date): Promise<void>;
}
