import type { StorageTrimRun } from '../entities/storage-trim-run.entity';
import type {
  StorageTrimStatus,
  StorageTrimTrigger,
} from '../types/automation.type';

export interface StartStorageTrimRunInput {
  trigger: StorageTrimTrigger;
  actorEmail: string | null;
}

export interface FinishStorageTrimRunInput {
  status: Exclude<StorageTrimStatus, 'running'>;
  message: string;
  allocatedBeforeBytes: number | null;
  allocatedAfterBytes: number | null;
  trimmedBytes: number | null;
}

/** 공간 반환 기록 저장소 포트 */
export interface IStorageTrimRunRepository {
  start(input: StartStorageTrimRunInput): Promise<StorageTrimRun>;
  finish(id: string, input: FinishStorageTrimRunInput): Promise<StorageTrimRun>;
  listRecent(limit: number): Promise<StorageTrimRun[]>;
  /** 마지막 예약 실행 — 같은 예약 시각을 두 번 돌리지 않으려고 쓴다 */
  findLatestScheduled(): Promise<StorageTrimRun | null>;
  /** 서버가 다시 시작돼 끝내지 못한 기록을 실패로 닫는다 */
  failUnfinished(message: string): Promise<number>;
}

export const STORAGE_TRIM_RUN_REPOSITORY = Symbol(
  'STORAGE_TRIM_RUN_REPOSITORY',
);
