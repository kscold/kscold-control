export type LogType =
  | 'backend'
  | 'pm2'
  | 'nginx-access'
  | 'nginx-error'
  | 'docker'
  | 'blog-backend'
  | 'blog-backend-err'
  | 'blog-access'
  | 'blog-frontend'
  | 'blog-frontend-err';

export type LogLineCount = number | 'all';
export type DockerLogSince =
  | 'none'
  | '15m'
  | '1h'
  | '6h'
  | '24h'
  | '168h'
  | 'custom';
export type DockerLogFilter = 'all' | 'errors' | 'nginx-access' | 'nginx-error';

/** 컨테이너 역할 — 서버가 분류해서 내려준다 */
export type DockerContainerRole = 'infra' | 'app';

export interface DockerContainer {
  id: string;
  name: string;
  status: string;
  role?: DockerContainerRole;
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
