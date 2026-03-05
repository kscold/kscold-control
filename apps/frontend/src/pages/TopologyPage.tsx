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
import { RefreshCw, Globe, Network, Server, Wifi, ArrowRight, Database, Cpu } from 'lucide-react';
import { api } from '../lib/api';

// ===== Types =====
interface Pm2Process {
  name: string;
  status: string;
  cpu: number;
  memory: number;
  restarts: number;
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

// ===== Image → Stack Metadata =====
interface StackMeta {
  label: string;           // 표시 이름
  type: 'app' | 'db' | 'proxy' | 'cache' | 'storage';
  color: string;           // border color class
  shadowColor: string;
  headerBg: string;
  stacks: Array<{ name: string; badge: string; color: string }>;
  knownServices: Array<{ name: string; port: number; icon: string }>;
}

function getStackMeta(image: string, containerName: string): StackMeta {
  const img = image.toLowerCase();
  const name = containerName.toLowerCase();

  if (img.includes('ubuntu-congbang') || name.includes('congbang')) {
    return {
      label: 'CongBang App',
      type: 'app',
      color: 'border-blue-500',
      shadowColor: 'shadow-blue-500/20',
      headerBg: 'bg-blue-950',
      stacks: [
        { name: 'Spring Boot 3.4', badge: 'Java 21', color: 'bg-orange-900 text-orange-300' },
        { name: 'Next.js 16', badge: 'Node 20', color: 'bg-green-900 text-green-300' },
        { name: 'PM2', badge: 'Process Mgr', color: 'bg-indigo-900 text-indigo-300' },
      ],
      knownServices: [
        { name: 'PostgreSQL 16', port: 5432, icon: '🐘' },
        { name: 'Redis', port: 6379, icon: '🟥' },
        { name: 'MongoDB 7', port: 27017, icon: '🍃' },
      ],
    };
  }

  if (img.includes('ubuntu-galjido') || name.includes('galjido')) {
    return {
      label: 'Galjido App',
      type: 'app',
      color: 'border-purple-500',
      shadowColor: 'shadow-purple-500/20',
      headerBg: 'bg-purple-950',
      stacks: [
        { name: 'Ubuntu 22.04', badge: 'Linux', color: 'bg-orange-900 text-orange-300' },
        { name: 'OpenSSH', badge: ':22→2223', color: 'bg-gray-700 text-gray-300' },
      ],
      knownServices: [
        { name: 'PostgreSQL', port: 5433, icon: '🐘' },
      ],
    };
  }

  if (img.includes('postgres') || name.includes('infra-db') || name.includes('postgres')) {
    return {
      label: 'PostgreSQL',
      type: 'db',
      color: 'border-sky-500',
      shadowColor: 'shadow-sky-500/20',
      headerBg: 'bg-sky-950',
      stacks: [
        { name: 'PostgreSQL 15', badge: 'Alpine', color: 'bg-sky-900 text-sky-300' },
      ],
      knownServices: [
        { name: 'PostgreSQL', port: 5432, icon: '🐘' },
      ],
    };
  }

  if (img.includes('nginx') || name.includes('nginx')) {
    return {
      label: 'Nginx Proxy',
      type: 'proxy',
      color: 'border-amber-500',
      shadowColor: 'shadow-amber-500/20',
      headerBg: 'bg-amber-950',
      stacks: [
        { name: 'Nginx', badge: 'Reverse Proxy', color: 'bg-amber-900 text-amber-300' },
        { name: 'SSL/TLS', badge: 'Let\'s Encrypt', color: 'bg-green-900 text-green-300' },
      ],
      knownServices: [
        { name: 'HTTP', port: 80, icon: '🌐' },
        { name: 'HTTPS', port: 443, icon: '🔒' },
      ],
    };
  }

  if (img.includes('redis')) {
    return {
      label: 'Redis',
      type: 'cache',
      color: 'border-red-500',
      shadowColor: 'shadow-red-500/20',
      headerBg: 'bg-red-950',
      stacks: [{ name: 'Redis', badge: 'Cache', color: 'bg-red-900 text-red-300' }],
      knownServices: [{ name: 'Redis', port: 6379, icon: '🟥' }],
    };
  }

  if (img.includes('mongo')) {
    return {
      label: 'MongoDB',
      type: 'db',
      color: 'border-green-500',
      shadowColor: 'shadow-green-500/20',
      headerBg: 'bg-green-950',
      stacks: [{ name: 'MongoDB', badge: 'NoSQL', color: 'bg-green-900 text-green-300' }],
      knownServices: [{ name: 'MongoDB', port: 27017, icon: '🍃' }],
    };
  }

  // Default
  return {
    label: containerName,
    type: 'app',
    color: 'border-gray-600',
    shadowColor: 'shadow-gray-500/10',
    headerBg: 'bg-gray-800',
    stacks: [],
    knownServices: [],
  };
}

// ===== Helpers =====
function formatMemory(bytes: number): string {
  if (!bytes) return '';
  const mb = bytes / 1024 / 1024;
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)}G` : `${mb.toFixed(0)}M`;
}

function pm2Dot(status: string) {
  if (status === 'online') return 'bg-green-400 shadow-green-400/50 shadow-sm';
  if (status === 'stopped') return 'bg-gray-500';
  return 'bg-red-400 shadow-red-400/50 shadow-sm';
}

// ===== Custom Node Components =====
function InternetNode({ data }: NodeProps) {
  return (
    <div className="bg-gradient-to-br from-indigo-900 to-purple-900 border-2 border-indigo-500 rounded-2xl px-5 py-4 min-w-[160px] shadow-lg shadow-indigo-500/20">
      <Handle type="source" position={Position.Bottom} className="!bg-indigo-400 !w-3 !h-3" />
      <div className="flex items-center gap-2">
        <Wifi size={18} className="text-indigo-300" />
        <div>
          <p className="text-white font-bold text-sm">Internet</p>
          <p className="text-indigo-300 text-[10px]">External Traffic</p>
        </div>
      </div>
    </div>
  );
}

function HostNode({ data }: NodeProps) {
  const d = data as any;
  return (
    <div className="bg-gray-800 border-2 border-blue-500 rounded-2xl shadow-lg shadow-blue-500/15 min-w-[220px]">
      <Handle type="source" position={Position.Bottom} className="!bg-blue-500 !w-3 !h-3" />
      <Handle type="target" position={Position.Top} className="!bg-blue-500 !w-3 !h-3" />
      <div className="bg-blue-950 rounded-t-2xl px-4 py-2.5 flex items-center gap-2">
        <Server size={15} className="text-blue-400" />
        <span className="text-white font-bold text-sm">{d.label}</span>
        <span className="ml-auto text-[9px] bg-blue-800 text-blue-300 px-1.5 py-0.5 rounded">HOST</span>
      </div>
      <div className="px-4 py-2.5">
        <div className="flex flex-wrap gap-1 mb-2">
          {[
            { t: 'macOS', c: 'bg-gray-700 text-gray-300' },
            { t: 'Colima', c: 'bg-gray-700 text-gray-300' },
            { t: 'Docker', c: 'bg-blue-900 text-blue-300' },
          ].map((b) => (
            <span key={b.t} className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${b.c}`}>{b.t}</span>
          ))}
        </div>
        <p className="text-[10px] text-gray-400">{d.subtitle}</p>
      </div>
    </div>
  );
}

function ContainerNode({ data }: NodeProps) {
  const d = data as any;
  const isRunning = d.status === 'running';
  const meta: StackMeta = d.meta;
  const processes: ContainerProcesses = d.processes || { pm2: [], services: [] };

  // PM2 from API, fallback to known services
  const pm2List: Pm2Process[] = processes.pm2;
  const runtimeServices: SystemService[] = processes.services.length > 0
    ? processes.services
    : meta.knownServices.map((s) => ({ ...s }));

  return (
    <div className={`bg-gray-900 border-2 rounded-xl shadow-lg flex flex-col min-w-[220px] max-w-[260px] ${meta.color} ${meta.shadowColor}`}>
      <Handle type="target" position={Position.Top} className="!bg-green-500 !w-2.5 !h-2.5" />
      <Handle type="source" position={Position.Bottom} className="!bg-green-500 !w-2.5 !h-2.5" />

      {/* Header */}
      <div className={`${meta.headerBg} rounded-t-xl px-3 py-2 flex items-center gap-2`}>
        <span className="text-white font-bold text-xs truncate flex-1">{d.label}</span>
        <span
          className={`flex-shrink-0 text-[9px] px-1.5 py-0.5 rounded font-medium ${
            isRunning
              ? 'bg-green-800 text-green-300'
              : 'bg-gray-700 text-gray-400'
          }`}
        >
          {isRunning ? '● Running' : '○ Stopped'}
        </span>
      </div>

      {/* Image */}
      <div className="px-3 pt-2 pb-1">
        <p className="text-[9px] text-gray-500 font-mono truncate">{d.image}</p>
      </div>

      {/* Tech Stack Badges */}
      {meta.stacks.length > 0 && (
        <div className="px-3 pb-2 flex flex-wrap gap-1">
          {meta.stacks.map((s, i) => (
            <span key={i} className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${s.color}`}>
              {s.name}
              {s.badge && <span className="opacity-60 ml-1">{s.badge}</span>}
            </span>
          ))}
        </div>
      )}

      {/* Port Mappings */}
      {d.ports && Object.keys(d.ports).length > 0 && (
        <div className="px-3 py-1.5 border-t border-gray-800">
          <p className="text-[8px] text-gray-600 uppercase tracking-wider mb-1">Ports</p>
          <div className="flex flex-wrap gap-1">
            {Object.entries(d.ports).map(([internal, external]) => (
              <span key={internal} className="text-[9px] bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded font-mono">
                {String(external)}→{internal}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* PM2 Processes */}
      {pm2List.length > 0 && (
        <div className="px-3 py-1.5 border-t border-gray-800">
          <div className="flex items-center gap-1 mb-1.5">
            <Cpu size={9} className="text-indigo-400" />
            <p className="text-[8px] text-indigo-400 uppercase tracking-wider">PM2 Processes</p>
          </div>
          {pm2List.map((p, i) => (
            <div key={i} className="flex items-center gap-1.5 mb-1 last:mb-0">
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${pm2Dot(p.status)}`} />
              <span className="text-[10px] text-gray-200 font-mono truncate flex-1">{p.name}</span>
              <div className="flex gap-1 text-[8px] text-gray-500 flex-shrink-0">
                {p.cpu > 0 && <span>{p.cpu.toFixed(0)}%</span>}
                {p.memory > 0 && <span>{formatMemory(p.memory)}</span>}
                {p.restarts > 0 && <span className="text-yellow-600">↺{p.restarts}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* System Services */}
      {runtimeServices.length > 0 && (
        <div className="px-3 py-1.5 border-t border-gray-800">
          <div className="flex items-center gap-1 mb-1.5">
            <Database size={9} className="text-purple-400" />
            <p className="text-[8px] text-purple-400 uppercase tracking-wider">Services</p>
          </div>
          {runtimeServices.map((s, i) => (
            <div key={i} className="flex items-center gap-1.5 mb-1 last:mb-0">
              <span className="text-[11px] leading-none">{s.icon}</span>
              <span className="text-[10px] text-gray-300 flex-1">{s.name}</span>
              <span className="text-[9px] text-gray-500 font-mono flex-shrink-0">:{s.port}</span>
            </div>
          ))}
        </div>
      )}

      {/* Stopped state */}
      {!isRunning && (
        <div className="px-3 py-2 border-t border-gray-800 text-center">
          <p className="text-[9px] text-gray-600">컨테이너 중지됨</p>
        </div>
      )}
    </div>
  );
}

function NginxNode({ data }: NodeProps) {
  const d = data as any;
  return (
    <div className={`bg-gray-900 border-2 rounded-xl shadow-lg min-w-[180px] ${d.enabled ? 'border-amber-500 shadow-amber-500/15' : 'border-gray-600'}`}>
      <Handle type="target" position={Position.Top} className="!bg-amber-500 !w-2.5 !h-2.5" />
      <Handle type="source" position={Position.Bottom} className="!bg-amber-500 !w-2.5 !h-2.5" />
      <div className="bg-amber-950 rounded-t-xl px-3 py-2 flex items-center gap-2">
        <Globe size={13} className={d.enabled ? 'text-amber-400' : 'text-gray-500'} />
        <span className="text-white font-bold text-xs truncate flex-1">{d.domain}</span>
        <div className="flex gap-1 flex-shrink-0">
          {d.ssl && <span className="text-[9px] bg-green-900 text-green-400 px-1 py-0.5 rounded">SSL</span>}
          {d.websocket && <span className="text-[9px] bg-blue-900 text-blue-400 px-1 py-0.5 rounded">WS</span>}
          {!d.enabled && <span className="text-[9px] bg-gray-800 text-gray-500 px-1 py-0.5 rounded">OFF</span>}
        </div>
      </div>
      <div className="px-3 py-2">
        <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Upstream</p>
        <p className="text-[10px] text-gray-300 font-mono flex items-center gap-1">
          <ArrowRight size={8} className="text-amber-500" />
          {d.upstream}
        </p>
      </div>
    </div>
  );
}

function UpnpNode({ data }: NodeProps) {
  const d = data as any;
  return (
    <div className="bg-gray-900 border-2 border-purple-600 rounded-xl px-3 py-2.5 min-w-[130px] shadow-lg shadow-purple-500/10">
      <Handle type="target" position={Position.Top} className="!bg-purple-500 !w-2.5 !h-2.5" />
      <Handle type="source" position={Position.Bottom} className="!bg-purple-500 !w-2.5 !h-2.5" />
      <div className="flex items-center gap-1.5 mb-1">
        <Network size={12} className="text-purple-400" />
        <span className="text-white font-bold text-xs">:{d.publicPort}</span>
        <span className={`ml-auto text-[8px] px-1 py-0.5 rounded font-mono ${d.protocol === 'TCP' ? 'bg-blue-950 text-blue-400' : 'bg-orange-950 text-orange-400'}`}>
          {d.protocol}
        </span>
      </div>
      <p className="text-[9px] text-gray-500 flex items-center gap-1">
        <ArrowRight size={7} className="text-purple-500" />
        :{d.privatePort} {d.description && `· ${d.description}`}
      </p>
    </div>
  );
}

const nodeTypes = { host: HostNode, container: ContainerNode, nginx: NginxNode, upnp: UpnpNode, internet: InternetNode };

// ===== Main Component =====
export function TopologyPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState([] as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([] as Edge[]);
  const [loading, setLoading] = useState(true);
  const [processesLoading, setProcessesLoading] = useState(false);

  const fetchProcesses = useCallback(async (containers: ContainerData[]): Promise<Record<string, ContainerProcesses>> => {
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
  }, []);

  const buildGraph = useCallback(
    (containers: ContainerData[], sites: NginxSiteData[], upnpMappings: UpnpMappingData[], processMap: Record<string, ContainerProcesses>) => {
      const newNodes: Node[] = [];
      const newEdges: Edge[] = [];
      const COL_GAP = 280;
      const ROW_GAP = 180;
      const totalWidth = Math.max(containers.length, sites.length, 3) * COL_GAP;
      const centerX = totalWidth / 2;

      // Internet
      newNodes.push({ id: 'internet', type: 'internet', position: { x: centerX - 80, y: 0 }, data: { label: 'Internet' }, draggable: true });

      // Host
      newNodes.push({ id: 'host', type: 'host', position: { x: centerX - 110, y: ROW_GAP }, data: { label: 'Mac Mini', subtitle: 'Apple Silicon · Colima' }, draggable: true });
      newEdges.push({ id: 'internet-host', source: 'internet', target: 'host', animated: true, style: { stroke: '#6366f1', strokeWidth: 2 } });

      // UPnP
      const localUpnp = upnpMappings.filter((m) => m.local);
      if (localUpnp.length > 0) {
        const startX = centerX - ((localUpnp.length - 1) * COL_GAP) / 2 - 65;
        localUpnp.forEach((m, i) => {
          const id = `upnp-${m.publicPort}-${m.protocol}`;
          newNodes.push({ id, type: 'upnp', position: { x: startX + i * COL_GAP, y: ROW_GAP * 2 }, data: { publicPort: m.publicPort, privatePort: m.privatePort, protocol: m.protocol, description: m.description }, draggable: true });
          newEdges.push({ id: `host-${id}`, source: 'host', target: id, style: { stroke: '#a855f7', strokeWidth: 1.5 } });
        });
      }

      // Nginx sites
      const nginxY = ROW_GAP * (localUpnp.length > 0 ? 3 : 2);
      const nginxStartX = centerX - ((sites.length - 1) * COL_GAP) / 2 - 90;
      sites.forEach((site, i) => {
        const id = `nginx-${site.name}`;
        newNodes.push({ id, type: 'nginx', position: { x: nginxStartX + i * COL_GAP, y: nginxY }, data: { ...site } as Record<string, unknown>, draggable: true });
        newEdges.push({ id: `host-${id}`, source: 'host', target: id, style: { stroke: '#d97706', strokeWidth: 1.5 } });
        localUpnp.forEach((m) => {
          if (m.privatePort === 80 || m.privatePort === 443) {
            newEdges.push({ id: `upnp-${m.publicPort}-${m.protocol}-${id}`, source: `upnp-${m.publicPort}-${m.protocol}`, target: id, style: { stroke: '#a855f7', strokeWidth: 1, strokeDasharray: '4 4' } });
          }
        });
      });

      // Containers
      const containerY = nginxY + ROW_GAP * 1.6;
      const containerStartX = centerX - ((containers.length - 1) * COL_GAP) / 2 - 110;
      containers.forEach((container, i) => {
        const id = `container-${container.id}`;
        const meta = getStackMeta(container.image, container.name);
        newNodes.push({
          id,
          type: 'container',
          position: { x: containerStartX + i * COL_GAP, y: containerY },
          data: {
            label: meta.label || container.name,
            image: container.image,
            status: container.liveStatus,
            ports: container.ports,
            meta,
            processes: processMap[container.id] || { pm2: [], services: [] },
          },
          draggable: true,
        });

        sites.forEach((site) => {
          if (site.upstream.includes(container.name) || site.upstream.includes(container.name.replace('ubuntu-', ''))) {
            newEdges.push({ id: `nginx-${site.name}-${id}`, source: `nginx-${site.name}`, target: id, animated: site.enabled, style: { stroke: site.enabled ? '#22c55e' : '#4b5563', strokeWidth: 1.5 } });
          }
        });

        localUpnp.forEach((m) => {
          Object.entries(container.ports || {}).forEach(([internal, external]) => {
            const extPort = parseInt(String(external), 10);
            if (m.privatePort === extPort || m.publicPort === extPort) {
              const edgeId = `upnp-${m.publicPort}-${m.protocol}-${id}-${internal}`;
              if (!newEdges.find((e) => e.id === edgeId)) {
                newEdges.push({ id: edgeId, source: `upnp-${m.publicPort}-${m.protocol}`, target: id, style: { stroke: '#a855f7', strokeWidth: 1, strokeDasharray: '4 4' } });
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
      const containers: ContainerData[] = containersRes.status === 'fulfilled' ? containersRes.value.data : [];
      const sites: NginxSiteData[] = sitesRes.status === 'fulfilled' ? sitesRes.value.data : [];
      const upnpMappings: UpnpMappingData[] = upnpRes.status === 'fulfilled' ? upnpRes.value.data : [];

      buildGraph(containers, sites, upnpMappings, {});
      setLoading(false);
      setProcessesLoading(true);

      const processMap = await fetchProcesses(containers);
      buildGraph(containers, sites, upnpMappings, processMap);
    } catch (e) {
      console.error('Topology load failed', e);
    } finally {
      setLoading(false);
      setProcessesLoading(false);
    }
  }, [buildGraph, fetchProcesses]);

  useEffect(() => { loadTopology(); }, [loadTopology]);

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
            <span className="text-[10px] text-gray-500 ml-1 animate-pulse">프로세스 확인 중…</span>
          )}
        </div>
        <button
          onClick={loadTopology}
          disabled={loading || processesLoading}
          className="bg-gray-900/90 backdrop-blur border border-gray-700 rounded-xl px-3 py-2 text-gray-300 hover:text-white transition disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading || processesLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Legend */}
      <div className="absolute top-3 right-3 z-10 bg-gray-900/90 backdrop-blur border border-gray-700 rounded-xl px-3 py-2">
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px]">
          {[
            { color: 'bg-indigo-500', label: 'Internet' },
            { color: 'bg-blue-500', label: 'Host' },
            { color: 'bg-amber-500', label: 'Nginx' },
            { color: 'bg-blue-400', label: 'App' },
            { color: 'bg-sky-500', label: 'DB' },
            { color: 'bg-purple-500', label: 'UPnP' },
          ].map(({ color, label }) => (
            <span key={label} className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${color}`} />
              <span className="text-gray-400">{label}</span>
            </span>
          ))}
          <span className="flex items-center gap-1 border-l border-gray-700 pl-3">
            <Cpu size={9} className="text-indigo-400" />
            <span className="text-gray-400">PM2</span>
          </span>
          <span className="flex items-center gap-1">
            <Database size={9} className="text-purple-400" />
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
        <MiniMap nodeColor={miniMapNodeColor} maskColor="rgba(0,0,0,0.7)" className="!bg-gray-900 !border-gray-700 !rounded-xl" />
      </ReactFlow>
    </div>
  );
}
