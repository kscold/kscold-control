import { useCallback, useEffect, useState } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  Handle,
  Position,
  NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  RefreshCw,
  Globe,
  Network,
  Server,
  Wifi,
  ArrowRight,
  Database,
  Cpu,
  Box,
} from 'lucide-react';
import { api } from '../lib/api';

// ===== Types =====
interface Pm2Process {
  name: string;
  status: 'online' | 'stopped' | 'errored' | string;
  pid: number;
  cpu: number;
  memory: number;
  restarts: number;
  uptime: number | null;
}

interface SystemService {
  name: string;
  port: number;
  icon: string;
}

interface ContainerProcesses {
  pm2: Pm2Process[];
  services: SystemService[];
}

interface ContainerData {
  id: string;
  name: string;
  image: string;
  liveStatus: string;
  dockerId?: string;
  ports: Record<string, string>;
}

interface NginxSiteData {
  name: string;
  domain: string;
  upstream: string;
  ssl: boolean;
  enabled: boolean;
  websocket: boolean;
}

interface UpnpMappingData {
  publicPort: number;
  privatePort: number;
  protocol: string;
  description: string;
  enabled: boolean;
  local: boolean;
}

// ===== Helpers =====
function formatMemory(bytes: number): string {
  if (!bytes) return '0';
  const mb = bytes / 1024 / 1024;
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)}GB` : `${mb.toFixed(0)}MB`;
}

function serviceIcon(icon: string) {
  const map: Record<string, string> = {
    pg: '🐘',
    redis: '🟥',
    mongo: '🍃',
    mysql: '🐬',
    nginx: '🟩',
    ssh: '🔑',
  };
  return map[icon] || '⚙️';
}

function pm2StatusColor(status: string) {
  if (status === 'online') return 'text-green-400';
  if (status === 'stopped') return 'text-gray-500';
  return 'text-red-400';
}

function pm2StatusDot(status: string) {
  if (status === 'online') return 'bg-green-400';
  if (status === 'stopped') return 'bg-gray-500';
  return 'bg-red-400';
}

// ===== Custom Node Components =====
function HostNode({ data }: NodeProps) {
  return (
    <div className="bg-gray-800 border-2 border-blue-500 rounded-2xl px-5 py-4 min-w-[200px] shadow-lg shadow-blue-500/10">
      <Handle type="source" position={Position.Bottom} className="!bg-blue-500 !w-3 !h-3" />
      <Handle type="target" position={Position.Top} className="!bg-blue-500 !w-3 !h-3" />
      <div className="flex items-center gap-2 mb-1">
        <Server size={16} className="text-blue-400" />
        <span className="text-white font-bold text-sm">{(data as any).label}</span>
      </div>
      <p className="text-xs text-gray-400">{(data as any).subtitle}</p>
      {(data as any).pm2 && (data as any).pm2.length > 0 && (
        <div className="mt-2.5 border-t border-gray-700 pt-2">
          <p className="text-[9px] text-gray-500 mb-1.5 uppercase tracking-wider">Host PM2</p>
          {(data as any).pm2.map((p: Pm2Process, i: number) => (
            <div key={i} className="flex items-center gap-1.5 mb-1">
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${pm2StatusDot(p.status)}`} />
              <span className="text-[10px] text-gray-300 font-mono truncate max-w-[140px]">{p.name}</span>
              <span className={`text-[9px] ml-auto ${pm2StatusColor(p.status)}`}>{p.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ContainerNode({ data }: NodeProps) {
  const d = data as any;
  const isRunning = d.status === 'running';
  const processes: ContainerProcesses = d.processes || { pm2: [], services: [] };
  const hasPm2 = processes.pm2.length > 0;
  const hasServices = processes.services.length > 0;

  return (
    <div
      className={`bg-gray-900 border-2 rounded-xl shadow-lg flex flex-col min-w-[200px] max-w-[240px] ${
        isRunning ? 'border-green-600 shadow-green-500/10' : 'border-gray-600'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-green-500 !w-2.5 !h-2.5" />
      <Handle type="source" position={Position.Bottom} className="!bg-green-500 !w-2.5 !h-2.5" />

      {/* Header */}
      <div className="px-3 py-2.5 border-b border-gray-800">
        <div className="flex items-center gap-1.5">
          <Box size={13} className={isRunning ? 'text-green-400' : 'text-gray-500'} />
          <span className="text-white font-semibold text-xs truncate">{d.label}</span>
          <span
            className={`ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0 ${
              isRunning ? 'bg-green-400' : 'bg-gray-600'
            }`}
          />
        </div>
        <p className="text-[9px] text-gray-500 truncate mt-0.5">{d.image}</p>
      </div>

      {/* Port mappings */}
      {d.ports && Object.keys(d.ports).length > 0 && (
        <div className="px-3 py-1.5 border-b border-gray-800">
          <p className="text-[8px] text-gray-600 uppercase tracking-wider mb-1">Ports</p>
          <div className="flex flex-wrap gap-1">
            {Object.entries(d.ports).map(([internal, external]) => (
              <span
                key={internal}
                className="text-[9px] bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded font-mono"
              >
                {String(external)}:{internal}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* PM2 Processes */}
      {hasPm2 && (
        <div className="px-3 py-1.5 border-b border-gray-800">
          <div className="flex items-center gap-1 mb-1.5">
            <Cpu size={9} className="text-blue-400" />
            <p className="text-[8px] text-blue-400 uppercase tracking-wider">PM2</p>
          </div>
          {processes.pm2.map((p, i) => (
            <div key={i} className="flex items-center gap-1.5 mb-1 last:mb-0">
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${pm2StatusDot(p.status)}`} />
              <span className="text-[10px] text-gray-300 font-mono truncate flex-1">{p.name}</span>
              <div className="flex items-center gap-1 flex-shrink-0">
                {p.cpu > 0 && (
                  <span className="text-[8px] text-gray-500">{p.cpu.toFixed(0)}%</span>
                )}
                {p.memory > 0 && (
                  <span className="text-[8px] text-gray-500">{formatMemory(p.memory)}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* System Services (DB, SSH, etc.) */}
      {hasServices && (
        <div className="px-3 py-1.5">
          <div className="flex items-center gap-1 mb-1.5">
            <Database size={9} className="text-purple-400" />
            <p className="text-[8px] text-purple-400 uppercase tracking-wider">Services</p>
          </div>
          {processes.services.map((s, i) => (
            <div key={i} className="flex items-center gap-1.5 mb-1 last:mb-0">
              <span className="text-[10px]">{serviceIcon(s.icon)}</span>
              <span className="text-[10px] text-gray-300">{s.name}</span>
              <span className="text-[9px] text-gray-500 ml-auto font-mono">:{s.port}</span>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!hasPm2 && !hasServices && isRunning && (
        <div className="px-3 py-2 text-[9px] text-gray-600 text-center">
          프로세스 정보 없음
        </div>
      )}
      {!isRunning && (
        <div className="px-3 py-2 text-[9px] text-gray-600 text-center">중지됨</div>
      )}
    </div>
  );
}

function NginxNode({ data }: NodeProps) {
  const d = data as any;
  return (
    <div
      className={`bg-gray-900 border-2 rounded-xl px-4 py-3 min-w-[160px] shadow-lg ${
        d.enabled ? 'border-amber-600 shadow-amber-500/10' : 'border-gray-600'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-amber-500 !w-2.5 !h-2.5" />
      <Handle type="source" position={Position.Bottom} className="!bg-amber-500 !w-2.5 !h-2.5" />
      <div className="flex items-center gap-2 mb-1">
        <Globe size={14} className={d.enabled ? 'text-amber-400' : 'text-gray-500'} />
        <span className="text-white font-semibold text-xs">{d.domain}</span>
      </div>
      <div className="flex items-center gap-1 flex-wrap mt-1">
        {d.ssl && (
          <span className="text-[9px] bg-green-950 text-green-400 px-1.5 py-0.5 rounded">SSL</span>
        )}
        {d.websocket && (
          <span className="text-[9px] bg-blue-950 text-blue-400 px-1.5 py-0.5 rounded">WS</span>
        )}
        {!d.enabled && (
          <span className="text-[9px] bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded">OFF</span>
        )}
      </div>
      <p className="text-[10px] text-gray-500 mt-1 truncate max-w-[140px]">
        <ArrowRight size={8} className="inline mr-1" />
        {d.upstream}
      </p>
    </div>
  );
}

function UpnpNode({ data }: NodeProps) {
  const d = data as any;
  return (
    <div className="bg-gray-900 border-2 border-purple-600 rounded-xl px-4 py-3 min-w-[140px] shadow-lg shadow-purple-500/10">
      <Handle type="target" position={Position.Top} className="!bg-purple-500 !w-2.5 !h-2.5" />
      <Handle type="source" position={Position.Bottom} className="!bg-purple-500 !w-2.5 !h-2.5" />
      <div className="flex items-center gap-2 mb-1">
        <Network size={14} className="text-purple-400" />
        <span className="text-white font-semibold text-xs">:{d.publicPort}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span
          className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
            d.protocol === 'TCP' ? 'bg-blue-950 text-blue-400' : 'bg-orange-950 text-orange-400'
          }`}
        >
          {d.protocol}
        </span>
        <span className="text-[10px] text-gray-400">
          <ArrowRight size={8} className="inline" /> :{d.privatePort}
        </span>
      </div>
      {d.description && (
        <p className="text-[9px] text-gray-500 mt-1 truncate max-w-[120px]">{d.description}</p>
      )}
    </div>
  );
}

function InternetNode({ data }: NodeProps) {
  return (
    <div className="bg-gradient-to-br from-indigo-900 to-purple-900 border-2 border-indigo-500 rounded-2xl px-5 py-4 min-w-[140px] shadow-lg shadow-indigo-500/20">
      <Handle type="source" position={Position.Bottom} className="!bg-indigo-400 !w-3 !h-3" />
      <div className="flex items-center gap-2">
        <Wifi size={16} className="text-indigo-300" />
        <span className="text-white font-bold text-sm">{(data as any).label}</span>
      </div>
    </div>
  );
}

const nodeTypes = {
  host: HostNode,
  container: ContainerNode,
  nginx: NginxNode,
  upnp: UpnpNode,
  internet: InternetNode,
};

// ===== Main Component =====
export function TopologyPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState([] as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([] as Edge[]);
  const [loading, setLoading] = useState(true);
  const [processesLoading, setProcessesLoading] = useState(false);

  const fetchProcesses = useCallback(
    async (containers: ContainerData[]): Promise<Record<string, ContainerProcesses>> => {
      const running = containers.filter((c) => c.liveStatus === 'running' && c.dockerId);
      const results: Record<string, ContainerProcesses> = {};

      await Promise.allSettled(
        running.map(async (c) => {
          try {
            const res = await api.get(`/docker/containers/${c.dockerId}/processes`);
            results[c.id] = res.data;
          } catch {
            results[c.id] = { pm2: [], services: [] };
          }
        }),
      );

      return results;
    },
    [],
  );

  const buildGraph = useCallback(
    (
      containers: ContainerData[],
      sites: NginxSiteData[],
      upnpMappings: UpnpMappingData[],
      processMap: Record<string, ContainerProcesses>,
    ) => {
      const newNodes: Node[] = [];
      const newEdges: Edge[] = [];

      const COL_GAP = 260;
      const ROW_GAP = 160;

      const totalWidth = Math.max(containers.length, sites.length, 3) * COL_GAP;
      const centerX = totalWidth / 2;

      // 1. Internet
      newNodes.push({
        id: 'internet',
        type: 'internet',
        position: { x: centerX - 70, y: 0 },
        data: { label: 'Internet' },
        draggable: true,
      });

      // 2. Host
      newNodes.push({
        id: 'host',
        type: 'host',
        position: { x: centerX - 100, y: ROW_GAP },
        data: { label: 'Mac Mini', subtitle: 'Colima Docker Host' },
        draggable: true,
      });

      newEdges.push({
        id: 'internet-host',
        source: 'internet',
        target: 'host',
        animated: true,
        style: { stroke: '#6366f1', strokeWidth: 2 },
      });

      // 3. UPnP
      const localUpnp = upnpMappings.filter((m) => m.local);
      if (localUpnp.length > 0) {
        const upnpStartX = centerX - ((localUpnp.length - 1) * COL_GAP) / 2 - 70;
        localUpnp.forEach((m, i) => {
          const id = `upnp-${m.publicPort}-${m.protocol}`;
          newNodes.push({
            id,
            type: 'upnp',
            position: { x: upnpStartX + i * COL_GAP, y: ROW_GAP * 2 },
            data: {
              publicPort: m.publicPort,
              privatePort: m.privatePort,
              protocol: m.protocol,
              description: m.description,
            },
            draggable: true,
          });
          newEdges.push({
            id: `host-${id}`,
            source: 'host',
            target: id,
            style: { stroke: '#a855f7', strokeWidth: 1.5 },
          });
        });
      }

      // 4. Nginx
      const nginxY = ROW_GAP * (localUpnp.length > 0 ? 3 : 2);
      const nginxStartX = centerX - ((sites.length - 1) * COL_GAP) / 2 - 80;

      sites.forEach((site, i) => {
        const id = `nginx-${site.name}`;
        newNodes.push({
          id,
          type: 'nginx',
          position: { x: nginxStartX + i * COL_GAP, y: nginxY },
          data: {
            label: site.name,
            domain: site.domain,
            upstream: site.upstream,
            ssl: site.ssl,
            websocket: site.websocket,
            enabled: site.enabled,
          },
          draggable: true,
        });

        newEdges.push({
          id: `host-${id}`,
          source: 'host',
          target: id,
          style: { stroke: '#d97706', strokeWidth: 1.5 },
        });

        localUpnp.forEach((m) => {
          if (m.privatePort === 80 || m.privatePort === 443) {
            newEdges.push({
              id: `upnp-${m.publicPort}-${m.protocol}-${id}`,
              source: `upnp-${m.publicPort}-${m.protocol}`,
              target: id,
              style: { stroke: '#a855f7', strokeWidth: 1, strokeDasharray: '4 4' },
            });
          }
        });
      });

      // 5. Containers (with processes)
      const containerY = nginxY + ROW_GAP * 1.5;
      const containerStartX = centerX - ((containers.length - 1) * COL_GAP) / 2 - 100;

      containers.forEach((container, i) => {
        const id = `container-${container.id}`;
        newNodes.push({
          id,
          type: 'container',
          position: { x: containerStartX + i * COL_GAP, y: containerY },
          data: {
            label: container.name,
            image: container.image,
            status: container.liveStatus,
            ports: container.ports,
            processes: processMap[container.id] || { pm2: [], services: [] },
          },
          draggable: true,
        });

        sites.forEach((site) => {
          if (
            site.upstream.includes(container.name) ||
            site.upstream.includes(container.name.replace('ubuntu-', ''))
          ) {
            newEdges.push({
              id: `nginx-${site.name}-${id}`,
              source: `nginx-${site.name}`,
              target: id,
              animated: site.enabled,
              style: { stroke: site.enabled ? '#22c55e' : '#4b5563', strokeWidth: 1.5 },
            });
          }
        });

        localUpnp.forEach((m) => {
          const containerPorts = Object.entries(container.ports || {});
          containerPorts.forEach(([internal, external]) => {
            const extPort = parseInt(String(external), 10);
            if (m.privatePort === extPort || m.publicPort === extPort) {
              const edgeId = `upnp-${m.publicPort}-${m.protocol}-${id}-${internal}`;
              if (!newEdges.find((e) => e.id === edgeId)) {
                newEdges.push({
                  id: edgeId,
                  source: `upnp-${m.publicPort}-${m.protocol}`,
                  target: id,
                  style: { stroke: '#a855f7', strokeWidth: 1, strokeDasharray: '4 4' },
                });
              }
            }
          });
        });
      });

      setNodes(newNodes);
      setEdges(newEdges);
    },
    [setNodes, setEdges],
  );

  const loadTopology = useCallback(async () => {
    setLoading(true);
    try {
      const [containersRes, sitesRes, upnpRes] = await Promise.allSettled([
        api.get('/docker/containers/all'),
        api.get('/nginx/sites'),
        api.get('/upnp/mappings'),
      ]);

      const containers: ContainerData[] =
        containersRes.status === 'fulfilled' ? containersRes.value.data : [];
      const sites: NginxSiteData[] =
        sitesRes.status === 'fulfilled' ? sitesRes.value.data : [];
      const upnpMappings: UpnpMappingData[] =
        upnpRes.status === 'fulfilled' ? upnpRes.value.data : [];

      // First render without processes
      buildGraph(containers, sites, upnpMappings, {});

      setLoading(false);
      setProcessesLoading(true);

      // Then fetch processes and re-render
      const processMap = await fetchProcesses(containers);
      buildGraph(containers, sites, upnpMappings, processMap);
    } catch (e) {
      console.error('Topology load failed', e);
    } finally {
      setLoading(false);
      setProcessesLoading(false);
    }
  }, [buildGraph, fetchProcesses]);

  useEffect(() => {
    loadTopology();
  }, [loadTopology]);

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
      {/* Header */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
        <div className="bg-gray-900/90 backdrop-blur border border-gray-700 rounded-xl px-4 py-2 flex items-center gap-2">
          <Network size={16} className="text-purple-400" />
          <span className="text-white font-bold text-sm">Infrastructure Topology</span>
          {processesLoading && (
            <span className="text-[10px] text-gray-500 ml-1 animate-pulse">
              프로세스 로딩 중...
            </span>
          )}
        </div>
        <button
          onClick={loadTopology}
          disabled={loading || processesLoading}
          className="bg-gray-900/90 backdrop-blur border border-gray-700 rounded-xl px-3 py-2 flex items-center gap-1.5 text-gray-300 hover:text-white transition text-sm disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading || processesLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Legend */}
      <div className="absolute top-3 right-3 z-10 bg-gray-900/90 backdrop-blur border border-gray-700 rounded-xl px-3 py-2">
        <div className="flex flex-wrap gap-3 text-[10px]">
          {[
            { color: 'bg-indigo-500', label: 'Internet' },
            { color: 'bg-blue-500', label: 'Host' },
            { color: 'bg-amber-500', label: 'Nginx' },
            { color: 'bg-green-500', label: 'Container' },
            { color: 'bg-purple-500', label: 'UPnP' },
          ].map(({ color, label }) => (
            <span key={label} className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
              <span className="text-gray-400">{label}</span>
            </span>
          ))}
          <span className="flex items-center gap-1.5 border-l border-gray-700 pl-3">
            <Cpu size={10} className="text-blue-400" />
            <span className="text-gray-400">PM2</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Database size={10} className="text-purple-400" />
            <span className="text-gray-400">Services</span>
          </span>
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
        <MiniMap
          nodeColor={miniMapNodeColor}
          maskColor="rgba(0,0,0,0.7)"
          className="!bg-gray-900 !border-gray-700 !rounded-xl"
        />
      </ReactFlow>
    </div>
  );
}
