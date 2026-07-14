// 컨테이너 도메인 모델

export interface ContainerPorts {
  [internalPort: string]: number; // externalPort
}

export interface ContainerResources {
  cpus: number;
  memory: string; // e.g., "4g", "512m"
}

export interface ExternalAccess {
  ssh?: string; // e.g., "ssh user@domain.com -p 2222"
  http?: string; // e.g., "http://domain.com:8001"
  domain: string;
}

export interface Container {
  id: string;
  dockerId: string; // Docker daemon container ID
  name: string;
  image: string;
  status: string; // "created", "running", "exited", "stopped"
  ports: ContainerPorts;
  resources: ContainerResources;
  createdAt: string;
  liveStatus: string; // Real-time status from Docker
  externalAccess?: ExternalAccess;
  isManaged: boolean; // True if created by this system, False if external
  isComposeManaged: boolean;
}

export interface ComposeProvisioningTemplate {
  name: string;
  image: string;
  cpus: string;
  memLimit: string;
  command: string;
  ports: Record<string, number>;
}

export interface CreateContainerConfig {
  name: string;
  image: string;
  cpus: number;
  memory: string;
  sshPort: number;
  httpPort: number;
  environment?: Record<string, string>;
}
