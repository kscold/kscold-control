export type BackupEngine = 'mongodb';
export type BackupTrigger = 'schedule' | 'manual';
export type BackupRunStatus = 'running' | 'success' | 'failed';

/** 백업 실행 한 번의 기록 */
export interface BackupRun {
  id: string;
  targetId: string;
  targetName: string | null;
  trigger: BackupTrigger;
  status: BackupRunStatus;
  message: string;
  archivePath: string | null;
  archiveSizeBytes: number | null;
  /** 이번 실행에서 보관 기간이 지나 지운 백업 이름 */
  pruned: string[];
  /** 수동 실행을 요청한 사용자. 예약 실행이면 null */
  actorEmail: string | null;
  startedAt: string;
  finishedAt: string | null;
}

/** 디스크에 보관 중인 백업 하나 */
export interface BackupArchive {
  name: string;
  takenAt: string;
  path: string;
  sizeBytes: number;
}

/** 백업 대상 설정. 접속 URI 는 서버가 내려주지 않는다. */
export interface BackupTarget {
  id: string;
  name: string;
  description: string;
  engine: BackupEngine;
  /** 자격증명을 뺀 접속 위치 */
  connectionSummary: string;
  dumpImage: string;
  retentionDays: number;
  /** 매일 실행 시각 (`HH:mm`) */
  scheduleTime: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/** 백업 대상 하나의 현재 상태 */
export interface BackupTargetStatus extends BackupTarget {
  running: boolean;
  /** 다음 예약 실행 시각. 사용하지 않는 대상은 null */
  nextRunAt: string | null;
  lastRun: BackupRun | null;
  archives: BackupArchive[];
}

export interface BackupOverview {
  /** 실행 시각(HH:mm)을 해석하는 시간대 */
  timeZone: string;
  items: BackupTargetStatus[];
}

export interface CreateBackupTargetInput {
  name: string;
  description?: string;
  uri: string;
  retentionDays?: number;
  scheduleTime?: string;
  dumpImage?: string;
  enabled?: boolean;
}

/** 보낸 항목만 바뀐다. 이름은 바꿀 수 없다. */
export type UpdateBackupTargetInput = Partial<
  Omit<CreateBackupTargetInput, 'name'>
>;

export interface ListBackupRunsParams {
  targetId?: string;
  limit?: number;
}

/** 등록 화면의 기본값 — 서버 기본값과 같게 둔다 */
export const BACKUP_TARGET_DEFAULTS = {
  retentionDays: 10,
  scheduleTime: '03:30',
  dumpImage: 'mongo:7',
} as const;

/** 서버가 허용하는 대상 이름 형식 */
export const BACKUP_TARGET_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;

export const MAX_BACKUP_RETENTION_DAYS = 3650;
