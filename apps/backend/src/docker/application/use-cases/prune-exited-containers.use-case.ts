import { Injectable } from '@nestjs/common';
import { DockerCleanupService } from '../services/docker-cleanup.service';

/** 종료된 Docker 컨테이너 정리 */
@Injectable()
export class PruneExitedContainersUseCase {
  constructor(private readonly dockerCleanup: DockerCleanupService) {}

  execute(dryRun = true) {
    return this.dockerCleanup.pruneExitedContainers(dryRun);
  }
}
