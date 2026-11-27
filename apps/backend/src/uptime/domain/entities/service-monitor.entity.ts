import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { MonitorState } from '../policies/monitor-status.policy';

/** 주기적으로 열어 볼 주소 하나 */
@Entity('service_monitors')
export class ServiceMonitor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  @Column({ type: 'varchar', length: 500 })
  url: string;

  @Column({ name: 'interval_seconds', type: 'integer', default: 60 })
  intervalSeconds: number;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @Column({ type: 'varchar', length: 8, default: 'unknown' })
  state: MonitorState;

  @Column({ name: 'state_changed_at', type: 'timestamptz', nullable: true })
  stateChangedAt: Date | null;

  @Column({ name: 'last_checked_at', type: 'timestamptz', nullable: true })
  lastCheckedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
