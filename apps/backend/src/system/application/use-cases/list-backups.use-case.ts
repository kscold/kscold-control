import { Inject, Injectable } from '@nestjs/common';
import {
  MONGODB_BACKUP_REPOSITORY,
  type IMongodbBackupRepository,
  type MongodbBackupEntry,
} from '../../domain/repositories/mongodb-backup.repository';
import { assertValidBackupContainerName } from '../utils/backup-container-name';

/** 지정 컨테이너의 MongoDB 백업 목록 조회 */
@Injectable()
export class ListBackupsUseCase {
  constructor(
    @Inject(MONGODB_BACKUP_REPOSITORY)
    private readonly mongodbBackupRepository: IMongodbBackupRepository,
  ) {}

  async execute(containerName: string): Promise<MongodbBackupEntry[]> {
    assertValidBackupContainerName(containerName);
    return this.mongodbBackupRepository.list(containerName);
  }
}
