import type { Container } from '@/entities/container';

/**
 * 대시보드가 쓰는 컨테이너 정보.
 *
 * 같은 엔드포인트(/docker/containers)의 응답을 별도 타입으로 다시 선언하면
 * 백엔드 필드명이 바뀔 때 한쪽만 고쳐도 타입 검사를 통과해,
 * 화면에서 조용히 undefined 가 되는 문제가 생긴다.
 * 그래서 리소스를 소유한 엔티티 타입에서 필요한 필드만 파생시킨다.
 */
export type ContainerInfo = Pick<
  Container,
  'id' | 'name' | 'status' | 'liveStatus' | 'resources'
>;

export interface DockerStorageMetric {
  size: number;
  reclaimable: number;
  active: number;
  totalCount: number;
}

export interface DockerStorageUsage {
  total: number;
  reclaimable: number;
  storageLabel: string;
  storagePath: string | null;
  storagePathSize: number;
  lastCollectedAt: number | null;
  collectionState: 'fresh' | 'stale';
  warning: string | null;
  images: DockerStorageMetric;
  containers: DockerStorageMetric;
  volumes: DockerStorageMetric;
  buildCache: DockerStorageMetric;
}

export interface SystemInfo {
  cpu: { count: number; model: string };
  memory: { total: number; used: number; free: number; usedPercent: number };
  disk: {
    total: number;
    used: number;
    available: number;
    usedPercent: number;
    breakdown: {
      docker: number;
      applications: number;
      other: number;
      dockerUsage: DockerStorageUsage;
    };
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
