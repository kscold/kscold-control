import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

/**
 * 사용자가 볼 수 있는 백업 대상
 *
 * 백업 조회 권한(backup:read)만 가진 사용자는 여기에 배정된 대상만 본다.
 * 전역 관리자와 백업 관리 권한(backup:manage) 보유자는 배정 없이 전체를 본다.
 */
@Entity('user_backup_targets')
@Index('idx_user_backup_targets_target_id', ['targetId', 'userId'])
export class BackupTargetAccess {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @PrimaryColumn({ name: 'target_id', type: 'uuid' })
  targetId: string;

  @Column({ name: 'granted_by_id', type: 'uuid', nullable: true })
  grantedById: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
