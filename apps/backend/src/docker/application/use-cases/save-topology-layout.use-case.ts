import { Injectable } from '@nestjs/common';
import { DockerTopologyService } from '../services/docker-topology.service';
import type { TopologyNodePosition } from '../../domain/repositories/topology-layout.repository.interface';

/** 사용자별 Docker 토폴로지 노드 배치 저장 */
@Injectable()
export class SaveTopologyLayoutUseCase {
  constructor(private readonly dockerTopology: DockerTopologyService) {}

  execute(userId: string, positions: TopologyNodePosition[]) {
    return this.dockerTopology.saveNodePositions(userId, positions);
  }
}
