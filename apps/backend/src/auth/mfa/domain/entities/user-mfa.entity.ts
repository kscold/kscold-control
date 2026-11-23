import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('user_mfa')
export class UserMfa {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'totp_secret', type: 'text' })
  sealedTotpSecret: string;

  @Column({ name: 'last_used_step', type: 'integer' })
  lastUsedStep: number;

  @Column({ name: 'recovery_code_hashes', type: 'text', array: true })
  recoveryCodeHashes: string[];

  @Column({ name: 'enabled_at', type: 'timestamptz' })
  enabledAt: Date;
}
