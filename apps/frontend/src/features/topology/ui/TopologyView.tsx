import { useCallback } from 'react';
import {
  ReactFlow,
  type Node,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { RefreshCw, Network, Cpu, Database } from 'lucide-react';
import { InternetNode, HostNode, ContainerNode, NginxNode, UpnpNode } from './nodes';
import { useTopology } from '../hooks/useTopology';

const nodeTypes = {
  host: HostNode,
  container: ContainerNode,
  nginx: NginxNode,
  upnp: UpnpNode,
  internet: InternetNode,
};

export function TopologyView() {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    loading,
    processesLoading,
    loadTopology,
  } = useTopology();

  const miniMapNodeColor = useCallback((node: Node) => {
    switch (node.type) {
      case 'internet': return '#6366f1';
      case 'host': return '#3b82f6';
      case 'container': return '#22c55e';
      case 'nginx': return '#d97706';
      case 'upnp': return '#a855f7';
      default: return '#6b7280';
    }
  }, []);

  return (
    <div className="h-full w-full bg-gray-950 relative">
      {/* Header + Legend */}
      <div className="absolute top-3 left-3 right-3 z-10 flex items-center gap-2">
        <div className="bg-gray-900/90 backdrop-blur border border-gray-700 rounded-xl px-4 py-2 flex items-center gap-2 flex-shrink-0">
          <Network size={16} className="text-purple-400" />
          <span className="text-white font-bold text-sm">Infrastructure Topology</span>
          {processesLoading && (
            <span className="text-[10px] text-gray-500 ml-1 animate-pulse">프로세스 확인 중…</span>
          )}
        </div>
        <button
          onClick={loadTopology}
          disabled={loading || processesLoading}
          className="bg-gray-900/90 backdrop-blur border border-gray-700 rounded-xl px-3 py-2 text-gray-300 hover:text-white transition disabled:opacity-50 flex-shrink-0"
        >
          <RefreshCw size={14} className={loading || processesLoading ? 'animate-spin' : ''} />
        </button>
        <div className="bg-gray-900/90 backdrop-blur border border-gray-700 rounded-xl px-3 py-2 ml-auto flex-shrink-0 overflow-hidden">
          <div className="flex flex-wrap gap-x-2.5 gap-y-1 text-[10px]">
            {[
              { color: 'bg-indigo-500', label: 'Internet' },
              { color: 'bg-blue-500', label: 'Host' },
              { color: 'bg-amber-500', label: 'Nginx' },
              { color: 'bg-blue-400', label: 'App' },
              { color: 'bg-sky-500', label: 'DB' },
              { color: 'bg-rose-500', label: 'Storage' },
              { color: 'bg-purple-500', label: 'UPnP' },
            ].map(({ color, label }) => (
              <span key={label} className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${color}`} />
                <span className="text-gray-400">{label}</span>
              </span>
            ))}
            <span className="flex items-center gap-1 border-l border-gray-700 pl-2.5">
              <Cpu size={9} className="text-indigo-400" />
              <span className="text-gray-400">PM2</span>
            </span>
            <span className="flex items-center gap-1">
              <Database size={9} className="text-purple-400" />
              <span className="text-gray-400">Services</span>
            </span>
          </div>
        </div>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        defaultEdgeOptions={{ type: 'smoothstep' }}
        proOptions={{ hideAttribution: true }}
        style={{ background: '#030712' }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#1f2937" />
        <Controls className="!bg-gray-900 !border-gray-700 !rounded-xl !shadow-lg [&>button]:!bg-gray-800 [&>button]:!border-gray-700 [&>button]:!text-gray-300 [&>button:hover]:!bg-gray-700" />
        <MiniMap nodeColor={miniMapNodeColor} maskColor="rgba(0,0,0,0.7)" className="!bg-gray-900 !border-gray-700 !rounded-xl" />
      </ReactFlow>
    </div>
  );
}
