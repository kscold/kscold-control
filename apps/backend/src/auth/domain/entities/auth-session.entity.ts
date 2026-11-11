import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** 로그인 때 확인한 수단. 다단계 인증이 생기면 `mfa` 로 연 세션이 생긴다. */
export type SessionAssurance = 'password' | 'mfa';

/**
 * 로그인 한 번이 만든 서버 세션. 접근 토큰의 `sid` 가 이 행을 가리키고,
 * 행이 끊기거나 만료되면 같은 세션의 토큰은 서명이 맞아도 거절된다.
 */
@Entity('auth_sessions')
export class AuthSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  /** 사용자 미리보기 세션이면 그 미리보기를 연 관리자 세션 */
  @Column({ name: 'parent_session_id', type: 'uuid', nullable: true })
  parentSessionId: string | null;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'last_seen_at', type: 'timestamptz' })
  lastSeenAt: Date;

  /** 유휴 만료. 갱신할 때마다 늦춰지지만 절대 만료를 넘지 않는다. */
  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'absolute_expires_at', type: 'timestamptz' })
  absoluteExpiresAt: Date;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip: string | null;

  @Column({ name: 'user_agent', type: 'varchar', length: 512, nullable: true })
  userAgent: string | null;

  @Column({ type: 'varchar', length: 16, default: 'password' })
  assurance: SessionAssurance;

  @Column({ name: 'step_up_until', type: 'timestamptz', nullable: true })
  stepUpUntil: Date | null;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null;
}
