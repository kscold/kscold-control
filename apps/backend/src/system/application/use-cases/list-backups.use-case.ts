import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { isValidBackupContainerName } from '../../domain/policies/backup-container-name.policy';
import {
  MONGODB_BACKUP_REPOSITORY,
  type IMongodbBackupRepository,
  type MongodbBackupEntry,
} from '../../domain/repositories/mongodb-backup.repository.interface';

/** 지정 컨테이너의 MongoDB 백업 목록 조회 */
@Injectable()
export class ListBackupsUseCase {
  constructor(
    @Inject(MONGODB_BACKUP_REPOSITORY)
    private readonly mongodbBackupRepository: IMongodbBackupRepository,
  ) {}

  async execute(containerName: string): Promise<MongodbBackupEntry[]> {
    if (!isValidBackupContainerName(containerName)) {
      throw new BadRequestException('잘못된 컨테이너 이름입니다.');
    }
    return this.mongodbBackupRepository.list(containerName);
  }
}
