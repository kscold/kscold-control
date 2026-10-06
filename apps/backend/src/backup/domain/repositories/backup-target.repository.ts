import type { BackupTarget } from '../entities/backup-target.entity';

/** 암호화한 접속 URI */
export interface SealedBackupUri {
  encryptedUri: string;
  uriIv: string;
  uriAuthTag: string;
}

export interface CreateBackupTargetInput extends SealedBackupUri {
  name: string;
  description: string;
  connectionSummary: string;
  dumpImage: string;
  retentionDays: number;
  scheduleTime: string;
  enabled: boolean;
  scheduleCursorAt: Date;
  createdBy: string | null;
}

/** 대상 수정 값. 넘기지 않은 항목은 그대로 둔다. */
export type UpdateBackupTargetInput = Partial<
  Omit<CreateBackupTargetInput, 'name' | 'createdBy'>
>;

/** 백업 대상 설정을 보관하는 포트 */
export interface IBackupTargetRepository {
  /** 이름순 전체 목록. 암호화한 URI 는 읽지 않는다. */
  findAll(): Promise<BackupTarget[]>;
  findEnabled(): Promise<BackupTarget[]>;
  findById(id: string): Promise<BackupTarget | null>;
  findByName(name: string): Promise<BackupTarget | null>;
  /** 덤프 실행용 — 암호화한 URI 까지 읽는다. */
  findByIdWithSecret(id: string): Promise<BackupTarget | null>;
  create(input: CreateBackupTargetInput): Promise<BackupTarget>;
  update(
    id: string,
    input: UpdateBackupTargetInput,
  ): Promise<BackupTarget | null>;
  /** 예약 실행 기준 시각만 옮긴다. 수정 시각은 건드리지 않는다. */
  moveScheduleCursor(id: string, at: Date): Promise<void>;
  remove(id: string): Promise<void>;
}

export const BACKUP_TARGET_REPOSITORY = Symbol('BACKUP_TARGET_REPOSITORY');
