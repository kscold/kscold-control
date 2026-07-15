import { Inject, Injectable } from '@nestjs/common';
import {
  MONGODB_BACKUP_REPOSITORY,
  type IMongodbBackupRepository,
} from '../../domain/repositories/mongodb-backup.repository';
import { assertValidBackupContainerName } from '../utils/backup-container-name';

/** 지정 컨테이너의 MongoDB(kscold-blog) 백업 수행 */
@Injectable()
export class BackupMongodbUseCase {
  constructor(
    @Inject(MONGODB_BACKUP_REPOSITORY)
    private readonly mongodbBackupRepository: IMongodbBackupRepository,
  ) {}

  async execute(
    containerName: string,
  ): Promise<{ path: string; size: string }> {
    assertValidBackupContainerName(containerName);
    return this.mongodbBackupRepository.create(containerName);
  }
}
