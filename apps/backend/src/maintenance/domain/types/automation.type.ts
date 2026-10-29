/** 자동 작업이 도는 곳 — Control 안 예약 작업, 맥 launchd 작업, 컨테이너 안 정리 */
export type AutomationKind = 'control' | 'launchd' | 'container';

/** 화면에 보여주는 상태 */
export type AutomationHealth =
  'ok' | 'failed' | 'stopped' | 'running' | 'unknown';

/** 자동 작업 하나 — 어디서 도는지와 상관없이 같은 모양으로 보여준다 */
export interface AutomationJob {
  key: string;
  kind: AutomationKind;
  name: string;
  description: string;
  schedule: string;
  health: AutomationHealth;
  lastRunAt: Date | null;
  lastMessage: string | null;
}

/** launchd 등록 파일에서 읽은 실행 일정 */
export interface LaunchdSchedule {
  calendar: Array<{ hour?: number; minute?: number; weekday?: number }>;
  intervalSeconds: number | null;
  runAtLoad: boolean;
  keepAlive: boolean;
  /** 로그인(부팅) 때 한 번만 돌고 끝나는 작업 — 끝난 뒤 launchd 목록에서 빠지는 게 정상 */
  launchOnlyOnce: boolean;
}

/** launchd 작업을 읽은 원자료 */
export interface LaunchdJobInfo {
  label: string;
  domain: 'gui' | 'system';
  /** 실행하는 스크립트나 프로그램 이름 */
  program: string;
  schedule: LaunchdSchedule;
  loaded: boolean;
  running: boolean;
  /** 아직 한 번도 끝나지 않았으면 null */
  lastExitCode: number | null;
  /** 출력 기록 파일이 마지막으로 바뀐 시각 (마지막 실행 시각 대신 씀) */
  logUpdatedAt: Date | null;
  lastLogLine: string | null;
}

/** 컨테이너 안에서 배포마다 쌓이고 자동으로 정리되는 릴리스 폴더 */
export interface ReleaseDirConfig {
  label: string;
  container: string;
  path: string;
  /** 정리 뒤 남기는 개수 */
  keep: number;
  /** 마지막 배포 시각(deployedAt)을 담은 JSON 파일 */
  stateFile?: string;
}

export interface ReleaseDirInfo {
  count: number;
  sizeBytes: number;
  lastDeployedAt: Date | null;
}

export type StorageTrimTrigger = 'schedule' | 'manual';
export type StorageTrimStatus = 'running' | 'succeeded' | 'failed';
