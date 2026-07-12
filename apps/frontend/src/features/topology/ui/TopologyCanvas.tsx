import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ContainerNode, HostNode, InternetNode, NginxNode } from './nodes';
import type { TopologySnapshot } from '../lib/topology.types';
import { useTopologyCanvasState } from '../hooks/useTopologyCanvasState';

const nodeTypes = {
  host: HostNode,
  container: ContainerNode,
  nginx: NginxNode,
  internet: InternetNode,
};

interface TopologyCanvasProps {
  snapshot: TopologySnapshot | null;
}

export function TopologyCanvas({ snapshot }: TopologyCanvasProps) {
  const { nodes, edges, onNodesChange, onEdgesChange, onNodeDragStop } =
    useTopologyCanvasState(snapshot);

  const miniMapNodeColor = (node: Node) => {
    switch (node.type) {
      case 'internet':
        return '#6366f1';
      case 'host':
        return '#3b82f6';
      case 'container':
        return '#22c55e';
      case 'nginx':
        return '#d97706';
      default:
        return '#6b7280';
    }
  };

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeDragStop={onNodeDragStop}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.16 }}
      defaultEdgeOptions={{ type: 'smoothstep' }}
      proOptions={{ hideAttribution: true }}
      minZoom={0.35}
      maxZoom={1.2}
      style={{ background: '#030712' }}
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={20}
        size={1}
        color="#1f2937"
      />
      <Controls className="!rounded-xl !border-gray-700 !bg-gray-900 !shadow-lg [&>button]:!border-gray-700 [&>button]:!bg-gray-800 [&>button]:!text-gray-300 [&>button:hover]:!bg-gray-700" />
      <MiniMap
        nodeColor={miniMapNodeColor}
        maskColor="rgba(0,0,0,0.7)"
        className="!rounded-xl !border-gray-700 !bg-gray-900"
      />
    </ReactFlow>
  );
}
