import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { BackupRunStatus, BackupTrigger } from '../types/backup.type';
import { BackupTarget } from './backup-target.entity';

/** 백업 실행 한 번의 기록 */
@Entity('backup_runs')
@Index('idx_backup_runs_target_started_at', ['targetId', 'startedAt'])
@Index('idx_backup_runs_started_at', ['startedAt'])
export class BackupRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'target_id', type: 'uuid' })
  targetId: string;

  @ManyToOne(() => BackupTarget, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'target_id' })
  target?: BackupTarget;

  @Column({ name: 'trigger_type', type: 'varchar', length: 16 })
  trigger: BackupTrigger;

  @Column({ type: 'varchar', length: 16 })
  status: BackupRunStatus;

  @Column({ type: 'text', default: '' })
  message: string;

  @Column({ name: 'archive_path', type: 'text', nullable: true })
  archivePath: string | null;

  /** bigint 는 드라이버가 문자열로 돌려주므로 숫자로 바꿔 읽는다. */
  @Column({
    name: 'archive_size_bytes',
    type: 'bigint',
    nullable: true,
    transformer: {
      to: (value: number | null) => value,
      from: (value: string | number | null) =>
        value === null ? null : Number(value),
    },
  })
  archiveSizeBytes: number | null;

  /** 이번 실행에서 보관 기간이 지나 지운 백업 이름 */
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  pruned: string[];

  /** 수동 실행을 요청한 사용자. 예약 실행이면 비어 있다. */
  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId: string | null;

  @Column({ name: 'actor_email', type: 'varchar', length: 320, nullable: true })
  actorEmail: string | null;

  @Column({ name: 'started_at', type: 'timestamptz', default: () => 'now()' })
  startedAt: Date;

  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt: Date | null;
}
