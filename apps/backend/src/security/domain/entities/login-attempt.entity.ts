import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type {
  LoginAttemptReason,
  LoginAttemptResult,
  LoginOrigin,
} from '../login-guard/login-block.policy';

/** 로그인 시도 한 번. 성공·실패·거절을 모두 남기고 30일 뒤 지운다. */
@Entity('login_attempts')
export class LoginAttempt {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip: string | null;

  @Column({ type: 'varchar', length: 320 })
  account: string;

  @Column({ type: 'varchar', length: 16 })
  origin: LoginOrigin;

  @Column({ type: 'varchar', length: 16 })
  result: LoginAttemptResult;

  @Column({ type: 'varchar', length: 32, nullable: true })
  reason: LoginAttemptReason | null;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
