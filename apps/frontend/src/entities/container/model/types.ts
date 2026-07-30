// 컨테이너 도메인 모델

export interface ContainerPorts {
  [internalPort: string]: number; // 외부 포트
}

export interface ContainerResources {
  cpus: number;
  memory: string; // 예: "4g", "512m"
}

export interface ExternalAccess {
  ssh?: string; // 예: "ssh user@domain.com -p 2222"
  http?: string; // 예: "http://domain.com:8001"
  domain: string;
}

export interface Container {
  id: string;
  dockerId: string; // Docker 데몬이 관리하는 컨테이너 ID
  name: string;
  image: string;
  status: string; // "created", "running", "exited", "stopped" 중 하나
  ports: ContainerPorts;
  resources: ContainerResources;
  createdAt: string;
  liveStatus: string; // Docker에서 조회한 실시간 상태
  externalAccess?: ExternalAccess;
  isManaged: boolean; // 이 시스템이 생성한 컨테이너면 true, 외부 컨테이너면 false
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

