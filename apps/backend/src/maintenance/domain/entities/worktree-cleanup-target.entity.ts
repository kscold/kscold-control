import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * 작업 폴더 정리 대상
 *
 * 루트 디렉터리 바로 아래의 git 작업 폴더(worktree)들 중, 지워도 잃는 것이 없는 것만
 * 매일 정해진 시각에 지운다. 어떤 폴더를 남기는지는 보존 규칙(worktree-retention.policy)이 정한다.
 */
@Entity('worktree_cleanup_targets')
@Index('idx_worktree_cleanup_targets_enabled', ['enabled'])
export class WorktreeCleanupTarget {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** 백업 디렉터리 이름으로도 쓰이므로 만든 뒤에는 바꾸지 않는다. */
  @Index('worktree_cleanup_targets_name_key', { unique: true })
  @Column({ type: 'varchar', length: 64 })
  name: string;

  @Column({ type: 'text', default: '' })
  description: string;

  /** 정리할 작업 폴더들이 모여 있는 디렉터리 (예: ~/Desktop/pawpong-review/.worktrees) */
  @Index('worktree_cleanup_targets_root_path_key', { unique: true })
  @Column({ name: 'root_path', type: 'varchar', length: 1024 })
  rootPath: string;

  /** 최근에 손댄 순으로 남길 개수 */
  @Column({ name: 'keep_recent', type: 'integer', default: 3 })
  keepRecent: number;

  /** 기준 브랜치에 들어가지 않은 작업 폴더를 남길지 */
  @Column({ name: 'protect_unmerged', type: 'boolean', default: true })
  protectUnmerged: boolean;

  /** 이미 들어갔는지 확인할 기준 브랜치 (원격 추적 브랜치 이름) */
  @Column({
    name: 'base_refs',
    type: 'jsonb',
    default: () => `'["origin/dev","origin/main","origin/master"]'::jsonb`,
  })
  baseRefs: string[];

  /** 매일 실행할 시각 (`HH:mm`, Asia/Seoul) */
  @Column({
    name: 'schedule_time',
    type: 'varchar',
    length: 5,
    default: '04:30',
  })
  scheduleTime: string;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  /** 이 시각보다 뒤에 오는 예약 시각만 실행한다 (백업 대상과 같은 방식) */
  @Column({
    name: 'schedule_cursor_at',
    type: 'timestamptz',
    default: () => 'now()',
  })
  scheduleCursorAt: Date;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
