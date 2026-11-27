import { Column, Entity, PrimaryColumn } from 'typeorm';

/** 1분마다 남기는 CPU·메모리·디스크 사용률 (대시보드 추이 그래프용) */
@Entity('system_metric_samples')
export class SystemMetricSample {
  @PrimaryColumn({ name: 'sampled_at', type: 'timestamptz' })
  sampledAt: Date;

  @Column({ name: 'cpu_percent', type: 'real' })
  cpuPercent: number;

  @Column({ name: 'memory_percent', type: 'real' })
  memoryPercent: number;

  @Column({ name: 'disk_percent', type: 'real', nullable: true })
  diskPercent: number | null;
}
