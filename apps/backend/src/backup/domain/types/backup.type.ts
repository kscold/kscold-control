/** 지원하는 백업 대상 종류. 지금은 외부 MongoDB 만 다룬다. */
export type BackupEngine = 'mongodb';

export const BACKUP_ENGINES: readonly BackupEngine[] = ['mongodb'];

/** 실행 계기 — 예약 시각 도래 또는 화면에서 직접 실행 */
export type BackupTrigger = 'schedule' | 'manual';

export type BackupRunStatus = 'running' | 'success' | 'failed';

/**
 * 덤프 한 번에 필요한 접속 정보.
 * 복호화한 URI 가 들어 있으므로 로그나 응답에 그대로 싣지 않는다.
 */
export interface BackupDumpRequest {
  name: string;
  uri: string;
  image: string;
}

/** 방금 만든 백업 아카이브의 위치와 크기 */
export interface BackupArchiveResult {
  path: string;
  sizeBytes: number;
}

/** 디스크에 보관 중인 백업 아카이브 하나 */
export interface BackupArchive {
  /** 백업 디렉터리 이름 (UTC 기준 `YYYY-MM-DD_HH-mm-ss`) */
  name: string;
  /** 디렉터리 이름에서 읽은 백업 시각 */
  takenAt: Date;
  path: string;
  sizeBytes: number;
}

/** 수동 실행을 요청한 사용자 */
export interface BackupActor {
  id: string | null;
  email: string | null;
}
