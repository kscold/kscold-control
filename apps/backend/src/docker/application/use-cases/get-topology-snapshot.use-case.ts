import { Injectable } from '@nestjs/common';
import { DockerTopologyService } from '../services/docker-topology.service';

/** 사용자별 Docker 토폴로지 스냅샷 조회 */
@Injectable()
export class GetTopologySnapshotUseCase {
  constructor(private readonly dockerTopology: DockerTopologyService) {}

  execute(userId: string) {
    return this.dockerTopology.getSnapshot(userId);
  }
}
