import type { MongodbBackupEntry } from '../repositories/mongodb-backup.repository';

/** 예약 백업 대상인 외부 MongoDB 설정 */
export interface ScheduledBackupTarget {
  /** 백업 디렉터리 이름과 API 경로에 쓰는 식별자 */
  name: string;
  /** 접속 URI. 경로에 적힌 데이터베이스만 덤프한다. */
  uri: string;
  /** 이 일수보다 오래된 백업은 새 백업이 성공한 뒤 지운다. */
  retentionDays: number;
  /** mongodump 를 실행할 Docker 이미지 */
  image: string;
}

export type ScheduledBackupTrigger = 'schedule' | 'manual';

/** 예약 백업 한 번의 실행 결과 */
export interface ScheduledBackupRun {
  target: string;
  trigger: ScheduledBackupTrigger;
  startedAt: string;
  finishedAt: string;
  success: boolean;
  message: string;
  path: string | null;
  size: string | null;
  /** 이번 실행에서 보관 기간이 지나 지운 백업 이름 */
  pruned: string[];
}

/** 예약 백업 대상 하나의 현재 상태. 접속 URI 는 담지 않는다. */
export interface ScheduledBackupTargetStatus {
  name: string;
  retentionDays: number;
  running: boolean;
  lastRun: ScheduledBackupRun | null;
  backups: MongodbBackupEntry[];
}

/** 예약 백업 전체 현황 */
export interface ScheduledBackupOverview {
  schedule: { cron: string; timeZone: string };
  targets: ScheduledBackupTargetStatus[];
}
