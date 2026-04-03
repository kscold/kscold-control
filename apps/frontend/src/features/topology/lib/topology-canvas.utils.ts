import type { Edge, Node } from '@xyflow/react';
import type { TopologySnapshot } from './topology.types';

export interface TopologyCanvasElements {
  nodes: Node[];
  edges: Edge[];
}

export function getTopologyCanvasElements(
  snapshot: TopologySnapshot | null,
): TopologyCanvasElements {
  return {
    nodes: (snapshot?.nodes ?? []) as unknown as Node[],
    edges: (snapshot?.edges ?? []) as unknown as Edge[],
  };
}
