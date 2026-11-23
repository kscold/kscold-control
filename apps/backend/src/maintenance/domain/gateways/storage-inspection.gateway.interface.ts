import type { DiskUsage, DockerUsageSnapshot } from '../types/storage.type';

/**
 * 맥 디스크·도커 VM 디스크·도커 사용량·폴더 크기를 읽는 포트.
 * 공간을 바꾸는 것은 trimDockerDisk 하나뿐이고 아무것도 지우지 않는다.
 */
export interface IStorageInspectionGateway {
  /** 맥 데이터 볼륨의 전체·사용·여유 공간 */
  hostDisk(): Promise<DiskUsage>;
  /** 도커 VM 디스크 파일 경로 */
  dockerVmDiskPath(): string;
  /** 도커 VM 디스크 파일이 맥에서 실제로 차지하는 크기 */
  dockerVmAllocatedBytes(): Promise<number>;
  /** VM 안 도커 파일시스템이 쓰는 크기. 읽지 못하면 null */
  dockerVmUsedBytes(): Promise<number | null>;
  /** VM 프로세스가 열어 둔 채 지워진 맥 파일 */
  heldDeletedFiles(): Promise<{ bytes: number; files: number }>;
  /** 컨테이너 쓰기 레이어·이미지·볼륨 사용량 */
  dockerUsage(): Promise<DockerUsageSnapshot>;
  /** 폴더 전체 크기. 폴더가 없으면 null */
  folderSize(path: string): Promise<number | null>;
  /** VM 안에서 지운 공간을 맥에 돌려준다 (fstrim). 명령 출력을 그대로 돌려준다 */
  trimDockerDisk(): Promise<string>;
}

export const STORAGE_INSPECTION_GATEWAY = Symbol('STORAGE_INSPECTION_GATEWAY');
