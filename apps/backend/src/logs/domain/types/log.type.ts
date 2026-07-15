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

export interface DockerContainerSummary {
  id: string;
  name: string;
  status: string;
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
