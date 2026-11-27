import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { isValidBackupContainerName } from '../../domain/policies/backup-container-name.policy';
import {
  MONGODB_BACKUP_REPOSITORY,
  type IMongodbBackupRepository,
} from '../../domain/repositories/mongodb-backup.repository.interface';

/** 지정 컨테이너의 MongoDB(sample-blog) 백업 수행 */
@Injectable()
export class BackupMongodbUseCase {
  constructor(
    @Inject(MONGODB_BACKUP_REPOSITORY)
    private readonly mongodbBackupRepository: IMongodbBackupRepository,
  ) {}

  async execute(
    containerName: string,
  ): Promise<{ path: string; size: string }> {
    if (!isValidBackupContainerName(containerName)) {
      throw new BadRequestException('잘못된 컨테이너 이름입니다.');
    }
    return this.mongodbBackupRepository.create(containerName);
  }
}
