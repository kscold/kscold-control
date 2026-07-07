import { useEffect, useMemo } from 'react';
import {
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
} from '@xyflow/react';
import type { TopologySnapshot } from '../lib/topology.types';
import { getTopologyCanvasElements } from '../lib/topology-canvas.utils';

export function useTopologyCanvasState(snapshot: TopologySnapshot | null) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => getTopologyCanvasElements(snapshot),
    [snapshot],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(
    initialNodes as Node[],
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    initialEdges as Edge[],
  );

  useEffect(() => {
    setNodes((currentNodes) => {
      const currentPositionById = new Map(
        currentNodes.map((node) => [node.id, node.position]),
      );

      return initialNodes.map((node) => ({
        ...node,
        position: currentPositionById.get(node.id) ?? node.position,
      }));
    });
    setEdges(initialEdges);
  }, [initialEdges, initialNodes, setEdges, setNodes]);

  return {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
  };
}
