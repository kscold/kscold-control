import { Injectable } from '@nestjs/common';
import { DockerTopologyService } from '../services/docker-topology.service';

/** 사용자별 Docker 토폴로지 노드 배치를 기본값으로 되돌림 */
@Injectable()
export class ResetTopologyLayoutUseCase {
  constructor(private readonly dockerTopology: DockerTopologyService) {}

  async execute(userId: string): Promise<{ removed: number }> {
    return { removed: await this.dockerTopology.resetNodePositions(userId) };
  }
}
