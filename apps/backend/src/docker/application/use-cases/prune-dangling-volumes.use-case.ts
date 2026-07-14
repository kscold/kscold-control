import { Injectable } from '@nestjs/common';
import { DockerCleanupService } from '../services/docker-cleanup.service';

/** 연결되지 않은 Docker 볼륨 정리 */
@Injectable()
export class PruneDanglingVolumesUseCase {
  constructor(private readonly dockerCleanup: DockerCleanupService) {}

  execute(dryRun = true) {
    return this.dockerCleanup.pruneDanglingVolumes(dryRun);
  }
}
