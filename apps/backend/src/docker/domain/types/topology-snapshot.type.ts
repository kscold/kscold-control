export type TopologyNodeType =
  'internet' | 'host' | 'container' | 'nginx' | 'service';

export interface TopologyPosition {
  x: number;
  y: number;
}

export interface TopologySnapshotNode {
  id: string;
  type: TopologyNodeType;
  position: TopologyPosition;
  data: unknown;
  draggable?: boolean;
}

export interface TopologySnapshotEdge {
  id: string;
  source: string;
  target: string;
  animated?: boolean;
  style?: Record<string, unknown>;
}

export interface TopologySnapshotSummary {
  generatedAt: number;
  containerCount: number;
  siteCount: number;
  serviceNodeCount: number;
}

export interface TopologySnapshot {
  nodes: TopologySnapshotNode[];
  edges: TopologySnapshotEdge[];
  summary: TopologySnapshotSummary;
}
