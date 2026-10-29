/** 맥 디스크 한 볼륨의 사용량 */
export interface DiskUsage {
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
}

/**
 * 도커 VM 디스크 — 맥에서 차지하는 크기와 VM 안에서 실제로 쓰는 크기.
 * 둘의 차이는 VM 안에서 지웠지만 맥에 아직 돌려주지 않은 공간이다.
 */
export interface DockerVmDisk {
  path: string;
  allocatedBytes: number;
  /** VM 안 도커 파일시스템이 쓰는 크기 (읽지 못하면 null) */
  usedBytes: number | null;
  /** 공간 반환(fstrim)으로 맥에 돌려줄 수 있는 크기 */
  reclaimableBytes: number | null;
  /** VM이 열어 둔 채 지워진 맥 파일 — VM을 다시 시작해야 돌아온다 */
  heldDeletedBytes: number | null;
  heldDeletedFiles: number;
}

export interface StorageContainer {
  name: string;
  image: string;
  state: string;
  /** 이미지 위에 컨테이너가 따로 쌓은 쓰기 레이어 크기 */
  writableBytes: number;
  /** 쓰기 레이어가 기준보다 커서 안에 캐시·파일이 쌓인 것으로 보이는지 */
  oversized: boolean;
}

export interface StorageImage {
  id: string;
  /** 저장소:태그. 이름이 없는 이미지는 null */
  reference: string | null;
  sizeBytes: number;
  /** 다른 이미지와 나눠 쓰지 않아 지우면 실제로 돌아오는 크기 */
  uniqueBytes: number;
}

export interface StorageVolume {
  name: string;
  sizeBytes: number;
  /** compose 프로젝트 이름. compose 밖에서 만든 볼륨은 null */
  project: string | null;
}

export interface DockerUsageSnapshot {
  /** 쓰기 레이어가 큰 순서 */
  containers: StorageContainer[];
  /** 쓰는 컨테이너가 없는 이미지 */
  unusedImages: StorageImage[];
  /** 어떤 컨테이너도 연결하지 않은 볼륨 */
  unreferencedVolumes: StorageVolume[];
  buildCacheBytes: number;
}

export interface StorageFolderDefinition {
  key: string;
  label: string;
  description: string;
  path: string;
}

export interface StorageFolder extends StorageFolderDefinition {
  /** 폴더가 없거나 읽지 못하면 null */
  sizeBytes: number | null;
}

export interface StorageOverview {
  measuredAt: Date;
  host: DiskUsage | null;
  dockerVm: DockerVmDisk | null;
  docker: DockerUsageSnapshot | null;
  folders: StorageFolder[];
  /** 일부 항목을 읽지 못했을 때 이유 */
  warnings: string[];
}

export interface DockerDiskTrimResult {
  /** fstrim이 비운 블록 크기 (이미 비어 있던 블록도 포함) */
  trimmedBytes: number | null;
  allocatedBeforeBytes: number;
  allocatedAfterBytes: number;
}
