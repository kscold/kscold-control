export const TOPOLOGY_LAYOUT_REPOSITORY = Symbol('TOPOLOGY_LAYOUT_REPOSITORY');

export interface TopologyNodePosition {
  nodeId: string;
  x: number;
  y: number;
}

/**
 * 사용자별 토폴로지 노드 배치 저장소 포트.
 * 애플리케이션 계층이 TypeORM에 직접 의존하지 않도록 영속성 세부 감춤.
 */
export interface ITopologyLayoutRepository {
  upsertPositions(
    userId: string,
    positions: TopologyNodePosition[],
  ): Promise<void>;
  findPositionsByUser(userId: string): Promise<TopologyNodePosition[]>;
}
