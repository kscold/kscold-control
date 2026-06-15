import type { Edge, Node } from '@xyflow/react';
import type { TopologySnapshot } from './topology.types';

export interface TopologyCanvasElements {
  nodes: Node[];
  edges: Edge[];
}

export function getTopologyCanvasElements(
  snapshot: TopologySnapshot | null,
): TopologyCanvasElements {
  const hiddenNodeIds = new Set(
    (snapshot?.nodes ?? [])
      .filter((node) => node.type === 'service')
      .map((node) => node.id),
  );

  return {
    nodes: (snapshot?.nodes ?? []).filter(
      (node) => node.type !== 'service',
    ) as unknown as Node[],
    edges: (snapshot?.edges ?? []).filter(
      (edge) =>
        !hiddenNodeIds.has(edge.source) && !hiddenNodeIds.has(edge.target),
    ) as unknown as Edge[],
  };
}
