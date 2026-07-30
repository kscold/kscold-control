export type LogType =
  | 'backend'
  | 'nginx-access'
  | 'nginx-error'
  | 'docker'
  | 'pm2'
  | 'blog-backend'
  | 'blog-backend-err'
  | 'blog-access'
  | 'blog-frontend'
  | 'blog-frontend-err';

export type BlogLogType = Extract<LogType, `blog-${string}`>;

export type DockerLogFilter = 'all' | 'errors' | 'nginx-access' | 'nginx-error';

export interface Pm2LogResult {
  out: string[];
  error: string[];
}

/** 컨테이너 역할 — 로그 화면의 정렬·즐겨찾기 기준으로 쓰인다 */
export type DockerContainerRole = 'infra' | 'app';

export interface DockerContainerSummary {
  id: string;
  name: string;
  status: string;
  /**
   * 인프라(nginx·DB 등) 인지 애플리케이션인지.
   * 프론트가 이름 목록을 하드코딩하지 않도록 서버가 분류해서 내려준다.
   */
  role: DockerContainerRole;
}

export interface DockerLogReadOptions {
  containerId?: string;
  containerName?: string;
  tail?: number | 'all';
  timestamps?: boolean;
  since?: string;
  until?: string;
  filter?: DockerLogFilter;
}

export interface DockerLogArchiveSource {
  id: string;
  label: string;
  type: 'current' | 'rotated';
  path: string;
  size: number;
  modifiedAt: string;
  compressed: boolean;
}

export interface NginxStatus {
  running: boolean;
  version?: string;
}

export interface SystemInfo {
  hostname: string;
  uptime: string;
  memory: string;
}
