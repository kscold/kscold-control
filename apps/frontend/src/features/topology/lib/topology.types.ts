export interface Pm2Process {
  name: string;
  status: string;
  cpu: number;
  memory: number;
  restarts: number;
}

export interface SystemService {
  name: string;
  port: number;
  icon: string;
}

export interface ContainerProcesses {
  pm2: Pm2Process[];
  services: SystemService[];
}

export interface ContainerData {
  id: string;
  name: string;
  image: string;
  liveStatus: string;
  dockerId?: string;
  ports: Record<string, string>;
}

export interface NginxSiteData {
  name: string;
  domain: string;
  upstream: string;
  ssl: boolean;
  enabled: boolean;
  websocket: boolean;
}

export interface UpnpMappingData {
  publicPort: number;
  privatePort: number;
  protocol: string;
  description: string;
  enabled: boolean;
  local: boolean;
}

export interface ContainerNodeData {
  label: string;
  image: string;
  status: string;
  ports: Record<string, unknown>;
  meta: StackMeta;
  processes: ContainerProcesses;
}

export interface HostNodeData {
  label: string;
  subtitle: string;
}

export interface StackMeta {
  label: string;
  type: 'app' | 'db' | 'proxy' | 'cache' | 'storage';
  color: string;
  shadowColor: string;
  headerBg: string;
  stacks: Array<{ name: string; badge: string; color: string }>;
  knownServices: Array<{ name: string; port: number; icon: string }>;
}
