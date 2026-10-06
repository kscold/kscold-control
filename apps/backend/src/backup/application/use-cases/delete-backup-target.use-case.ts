import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { BackupTarget } from '../../domain/entities/backup-target.entity';
import {
  BACKUP_TARGET_REPOSITORY,
  type IBackupTargetRepository,
} from '../../domain/repositories/backup-target.repository';
import { BackupRunnerService } from '../services/backup-runner.service';

/**
 * 백업 대상 삭제
 *
 * 설정과 실행 이력만 지운다. 이미 만든 백업 파일은 복구 수단이므로 디스크에 남긴다.
 */
@Injectable()
export class DeleteBackupTargetUseCase {
  constructor(
    @Inject(BACKUP_TARGET_REPOSITORY)
    private readonly targetRepository: IBackupTargetRepository,
    private readonly runner: BackupRunnerService,
  ) {}

  async execute(id: string): Promise<BackupTarget> {
    const target = await this.targetRepository.findById(id);
    if (!target) {
      throw new NotFoundException('등록되지 않은 백업 대상입니다.');
    }
    if (this.runner.isRunning(target.id)) {
      throw new ConflictException(
        '백업이 진행 중인 대상은 삭제할 수 없습니다. 끝난 뒤 다시 시도하세요.',
      );
    }

    await this.targetRepository.remove(target.id);
    return target;
  }
}
