import { Injectable } from '@nestjs/common';
import { DockerCleanupService } from '../services/docker-cleanup.service';

/** Docker 빌드 캐시 정리 */
@Injectable()
export class PruneBuildCacheUseCase {
  constructor(private readonly dockerCleanup: DockerCleanupService) {}

  execute(dryRun = true) {
    return this.dockerCleanup.pruneBuildCache(dryRun);
  }
}
