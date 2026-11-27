export type MonitorState = 'unknown' | 'up' | 'down';

export interface ServiceMonitor {
  id: string;
  name: string;
  url: string;
  intervalSeconds: number;
  enabled: boolean;
  state: MonitorState;
  stateChangedAt: string | null;
  lastCheckedAt: string | null;
  uptime24hPercent: number | null;
  averageLatencyMs: number | null;
  lastError: string | null;
  recent: { at: string; ok: boolean; latencyMs: number | null }[];
}

export interface CreateMonitorInput {
  name: string;
  url: string;
  intervalSeconds: number;
}
