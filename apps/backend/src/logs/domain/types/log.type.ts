export type LogType =
  | 'backend'
  | 'nginx-access'
  | 'nginx-error'
  | 'docker'
  | 'pm2';

export interface Pm2LogResult {
  out: string[];
  error: string[];
}

export interface DockerContainerSummary {
  id: string;
  name: string;
  status: string;
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
