import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type IpBanSource = 'manual' | 'auto-nginx' | 'auto-ssh';

@Entity('ip_bans')
@Index('ip_bans_active_idx', ['active'], { where: '"active" = true' })
export class IpBan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ length: 64 })
  ip: string;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ length: 32, default: 'manual' })
  source: IpBanSource;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
