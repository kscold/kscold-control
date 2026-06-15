import { useEffect } from 'react';
import {
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
} from '@xyflow/react';
import type { TopologySnapshot } from '../lib/topology.types';
import { getTopologyCanvasElements } from '../lib/topology-canvas.utils';

export function useTopologyCanvasState(snapshot: TopologySnapshot | null) {
  const { nodes: initialNodes, edges: initialEdges } =
    getTopologyCanvasElements(snapshot);

  const [nodes, setNodes, onNodesChange] = useNodesState(
    initialNodes as Node[],
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    initialEdges as Edge[],
  );

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialEdges, initialNodes, setEdges, setNodes]);

  return {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
  };
}
