import { Injectable } from '@nestjs/common';
import { DockerCleanupService } from '../services/docker-cleanup.service';

/** Docker dangling 이미지 정리 */
@Injectable()
export class PruneDanglingImagesUseCase {
  constructor(private readonly dockerCleanup: DockerCleanupService) {}

  execute(dryRun = true) {
    return this.dockerCleanup.pruneDanglingImages(dryRun);
  }
}
