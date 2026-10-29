import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type {
  StorageTrimStatus,
  StorageTrimTrigger,
} from '../types/automation.type';

/** bigint 는 드라이버가 문자열로 돌려주므로 숫자로 바꿔 읽는다. */
const nullableBigint = {
  to: (value: number | null) => value,
  from: (value: string | number | null) =>
    value === null || value === undefined ? null : Number(value),
};

/** 도커 VM 공간 반환(fstrim) 한 번의 기록 */
@Entity('storage_trim_runs')
@Index('idx_storage_trim_runs_started_at', ['startedAt'])
export class StorageTrimRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'trigger_type', type: 'varchar', length: 16 })
  trigger: StorageTrimTrigger;

  @Column({ type: 'varchar', length: 16 })
  status: StorageTrimStatus;

  @Column({ type: 'text', default: '' })
  message: string;

  @Column({
    name: 'allocated_before_bytes',
    type: 'bigint',
    nullable: true,
    transformer: nullableBigint,
  })
  allocatedBeforeBytes: number | null;

  @Column({
    name: 'allocated_after_bytes',
    type: 'bigint',
    nullable: true,
    transformer: nullableBigint,
  })
  allocatedAfterBytes: number | null;

  @Column({
    name: 'trimmed_bytes',
    type: 'bigint',
    nullable: true,
    transformer: nullableBigint,
  })
  trimmedBytes: number | null;

  @Column({ name: 'actor_email', type: 'varchar', length: 255, nullable: true })
  actorEmail: string | null;

  @Column({ name: 'started_at', type: 'timestamptz' })
  startedAt: Date;

  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt: Date | null;
}
