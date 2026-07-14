import { Injectable } from '@nestjs/common';
import { DockerCleanupService } from '../services/docker-cleanup.service';

/** Docker 정리 대상 조회 */
@Injectable()
export class GetDockerCleanupCandidatesUseCase {
  constructor(private readonly dockerCleanup: DockerCleanupService) {}

  execute() {
    return this.dockerCleanup.getCandidates();
  }
}
