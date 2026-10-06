import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { BackupEngine } from '../types/backup.type';

/**
 * 백업 대상
 *
 * 접속 URI 에는 자격증명이 들어 있어 AES-256-GCM 으로 암호화해 저장하고,
 * 일반 조회에서는 암호문 컬럼을 읽지 않는다(select: false).
 * 화면에는 자격증명을 뺀 connectionSummary 만 보여준다.
 */
@Entity('backup_targets')
@Index('idx_backup_targets_enabled', ['enabled'])
export class BackupTarget {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** 백업 디렉터리 이름으로도 쓰이므로 만든 뒤에는 바꾸지 않는다. */
  @Index('backup_targets_name_key', { unique: true })
  @Column({ type: 'varchar', length: 64 })
  name: string;

  @Column({ type: 'text', default: '' })
  description: string;

  @Column({ type: 'varchar', length: 32, default: 'mongodb' })
  engine: BackupEngine;

  @Column({ name: 'encrypted_uri', type: 'text', select: false })
  encryptedUri: string;

  @Column({ name: 'uri_iv', type: 'varchar', length: 64, select: false })
  uriIv: string;

  @Column({ name: 'uri_auth_tag', type: 'varchar', length: 64, select: false })
  uriAuthTag: string;

  /** 자격증명과 옵션을 뺀 접속 위치 (예: mongodb+srv://cluster.example.net/prod) */
  @Column({ name: 'connection_summary', type: 'varchar', length: 255 })
  connectionSummary: string;

  /** mongodump 를 실행할 Docker 이미지 */
  @Column({
    name: 'dump_image',
    type: 'varchar',
    length: 200,
    default: 'mongo:7',
  })
  dumpImage: string;

  /** 이 일수보다 오래된 백업은 새 백업이 성공한 뒤 지운다. */
  @Column({ name: 'retention_days', type: 'integer', default: 10 })
  retentionDays: number;

  /** 매일 백업을 실행할 시각 (`HH:mm`, Asia/Seoul) */
  @Column({
    name: 'schedule_time',
    type: 'varchar',
    length: 5,
    default: '03:30',
  })
  scheduleTime: string;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  /**
   * 예약 실행 기준 시각. 이 시각보다 뒤에 오는 예약 시각만 실행한다.
   * 예약 실행을 시작할 때와 일정·사용 여부를 바꿀 때 현재 시각으로 옮긴다.
   */
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
