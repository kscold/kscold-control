// 컨테이너 API 요청/응답 타입

export interface CreateContainerRequest {
  name: string;
  image: string;
  ports: Record<string, number>;
  resources: {
    cpus: number;
    memory: string;
  };
  environment?: Record<string, string>;
}

export interface ContainerStatsResponse {
  cpuUsage: number;
  memoryUsage: number;
  networkIn: number;
  networkOut: number;
}
