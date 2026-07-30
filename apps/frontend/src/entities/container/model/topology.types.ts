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
  source?: 'config' | 'inferred';
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
  domains?: string[];
  gateway?: {
    mode: 'host-nginx' | 'container-nginx' | 'direct';
    label: string;
    details: string[];
  };
}

export interface HostNodeData {
  label: string;
  subtitle: string;
}

export interface TopologySnapshotNode {
  id: string;
  type: 'internet' | 'host' | 'container' | 'nginx' | 'service';
  position: { x: number; y: number };
  data: unknown;
  draggable?: boolean;
}

export interface TopologyNodePositionUpdate {
  nodeId: string;
  x: number;
  y: number;
}

export interface TopologySnapshotEdge {
  id: string;
  source: string;
  target: string;
  animated?: boolean;
  style?: Record<string, unknown>;
}

export interface TopologySnapshot {
  nodes: TopologySnapshotNode[];
  edges: TopologySnapshotEdge[];
  summary: {
    generatedAt: number;
    containerCount: number;
    siteCount: number;
    serviceNodeCount: number;
  };
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
