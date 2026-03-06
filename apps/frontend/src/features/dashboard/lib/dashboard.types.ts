export interface ContainerInfo {
  id: string;
  name: string;
  status: string;
  liveStatus: string;
  resources: { cpus: number; memory: string };
}

export interface SystemInfo {
  cpu: { count: number; model: string };
  memory: { total: number; used: number; free: number; usedPercent: number };
  disk: {
    total: number;
    used: number;
    available: number;
    usedPercent: number;
    breakdown: { docker: number; applications: number; other: number };
  };
  platform: string;
  hostname: string;
  uptime: number;
}

export interface LiveStats {
  cpu: { usage: number; count: number; model: string };
  memory: { total: number; used: number; free: number; usedPercent: number };
  uptime: number;
}
