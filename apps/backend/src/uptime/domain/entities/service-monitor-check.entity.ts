import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** 검사 한 번의 결과 */
@Entity('service_monitor_checks')
@Index('idx_service_monitor_checks_monitor_time', ['monitorId', 'checkedAt'])
export class ServiceMonitorCheck {
  // bigserial 은 드라이버가 문자열로 준다
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ name: 'monitor_id', type: 'uuid' })
  monitorId: string;

  @Column({ name: 'checked_at', type: 'timestamptz', default: () => 'now()' })
  checkedAt: Date;

  @Column({ type: 'boolean' })
  ok: boolean;

  @Column({ name: 'status_code', type: 'integer', nullable: true })
  statusCode: number | null;

  @Column({ name: 'latency_ms', type: 'integer', nullable: true })
  latencyMs: number | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  error: string | null;
}
