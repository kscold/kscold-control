import { Column, Entity, PrimaryColumn } from 'typeorm';

/** 등록을 마친 계정의 OTP. 행이 있으면 로그인할 때 2단계를 거친다. */
@Entity('user_mfa')
export class UserMfa {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  /** CONTROL_MFA_ENCRYPTION_KEY 로 봉인한 TOTP 비밀값 */
  @Column({ name: 'totp_secret', type: 'text' })
  totpSecret: string;

  /** 마지막으로 받아들인 코드의 step. 같은 코드나 더 오래된 코드는 다시 받지 않는다. */
  @Column({ name: 'last_used_step', type: 'integer' })
  lastUsedStep: number;

  /** 남은 복구 코드의 키 해시. 쓰면 배열에서 빠진다. */
  @Column({ name: 'recovery_code_hashes', type: 'text', array: true })
  recoveryCodeHashes: string[];

  @Column({ name: 'enabled_at', type: 'timestamptz' })
  enabledAt: Date;
}
