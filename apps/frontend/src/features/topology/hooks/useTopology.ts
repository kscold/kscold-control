import { useCallback, useEffect, useState } from 'react';
import { type Node, type Edge, useNodesState, useEdgesState } from '@xyflow/react';
import { api } from '../../../lib/api';
import type {
  ContainerData,
  NginxSiteData,
  UpnpMappingData,
  ContainerProcesses,
} from '../lib/topology.types';
import { getStackMeta } from '../lib/topology.utils';

export function useTopology() {
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
      const edgeIdSet = new Set<string>();
      const COL_GAP = 380;
      const ROW_GAP = 340;
      const NODE_HALF_W = 110;

      // 인프라 vs 앱 컨테이너 분리
      const isInfra = (c: ContainerData) =>
        c.name.includes('nginx') || c.name.includes('infra-db');
      const infraContainers = containers.filter(isInfra);
      const appContainers = containers.filter((c) => !isInfra(c));

      // site → app container 매핑 파악
      const siteToApp = new Map<string, string>();
      sites.forEach((site) => {
        const matched = appContainers.find(
          (c) => site.upstream.includes(c.name) || site.upstream.includes(c.name.replace('ubuntu-', '')),
        );
        if (matched) siteToApp.set(site.name, matched.id);
      });

      // ── 컬럼 계산: 앱 연결 sites → control → storage(bucket/minio, 빨간색 우측 묶음) ──
      const appLinkedSites = appContainers
        .map((c) => sites.find((s) => siteToApp.get(s.name) === c.id))
        .filter(Boolean) as NginxSiteData[];
      const controlSites = sites.filter((s) => !siteToApp.has(s.name) && !s.name.includes('minio') && !s.name.includes('bucket'));
      const storageSites = sites.filter((s) => s.name.includes('minio') || s.name.includes('bucket'));
      const sortedSites = [...appLinkedSites, ...controlSites, ...storageSites];
      const colCount = Math.max(sortedSites.length, appContainers.length, 5);
      const totalWidth = colCount * COL_GAP;
      const centerX = totalWidth / 2;
      const rowStartX = centerX - ((colCount - 1) * COL_GAP) / 2 - NODE_HALF_W;

      const addEdge = (edge: Edge) => {
        if (!edgeIdSet.has(edge.id)) {
          edgeIdSet.add(edge.id);
          newEdges.push(edge);
        }
      };

      // ══════ Row 0: Internet ══════
      newNodes.push({ id: 'internet', type: 'internet', position: { x: centerX - 80, y: 0 }, data: { label: 'Internet' }, draggable: true });

      // ══════ Row 1: Mac Mini Host ══════
      newNodes.push({ id: 'host', type: 'host', position: { x: centerX - 110, y: ROW_GAP * 0.9 }, data: { label: 'Mac Mini (Host)', subtitle: 'Apple M4 · macOS · Colima Docker' }, draggable: true });
      addEdge({ id: 'internet-host', source: 'internet', target: 'host', animated: true, style: { stroke: '#6366f1', strokeWidth: 2 } });

      // UPnP — Host 우측에 인접 배치
      const localUpnp = upnpMappings.filter((m) => m.local);
      if (localUpnp.length > 0) {
        const upnpX = centerX + 200;
        const upnpY = ROW_GAP * 0.9;
        localUpnp.forEach((m, i) => {
          const id = `upnp-${m.publicPort}-${m.protocol}`;
          newNodes.push({ id, type: 'upnp', position: { x: upnpX + i * 130, y: upnpY }, data: { publicPort: m.publicPort, privatePort: m.privatePort, protocol: m.protocol, description: m.description }, draggable: true });
          addEdge({ id: `host-${id}`, source: 'host', target: id, style: { stroke: '#a855f7', strokeWidth: 1.5 } });
        });
      }

      // ══════ Row 2: 인프라 계층 — Nginx | kscold-control | PostgreSQL ══════
      const infraY = ROW_GAP * 2;
      const nginxContainers = infraContainers.filter((c) => c.name.includes('nginx'));
      const dbContainers = infraContainers.filter((c) => !c.name.includes('nginx'));
      // 순서: Nginx Proxy(좌) | kscold-control(중) | PostgreSQL(우) — control↔DB 인접
      const hostServices = [
        ...nginxContainers.map((c) => ({ id: `container-${c.id}`, label: c.name, subtitle: c.image, type: 'infra' as const, container: c })),
        { id: 'local-control', label: 'kscold-control', subtitle: 'NestJS · PM2 · :4000', type: 'local' as const },
        ...dbContainers.map((c) => ({ id: `container-${c.id}`, label: c.name, subtitle: c.image, type: 'infra' as const, container: c })),
      ];
      const infraStartX = centerX - ((hostServices.length - 1) * COL_GAP) / 2 - NODE_HALF_W;

      hostServices.forEach((svc, i) => {
        if (svc.type === 'local') {
          newNodes.push({
            id: svc.id,
            type: 'container',
            position: { x: infraStartX + i * COL_GAP, y: infraY },
            data: {
              label: svc.label,
              image: 'local (PM2)',
              status: 'running',
              ports: { '4000': 4000 },
              meta: {
                label: 'kscold-control',
                type: 'app',
                color: 'border-cyan-500',
                shadowColor: 'shadow-cyan-500/20',
                headerBg: 'bg-cyan-950',
                stacks: [
                  { name: 'NestJS', badge: 'Node.js', color: 'bg-cyan-900 text-cyan-300' },
                  { name: 'PM2', badge: 'Local', color: 'bg-gray-700 text-gray-300' },
                ],
                knownServices: [
                  { name: 'API', port: 4000, icon: '⚡' },
                  { name: 'WebSocket', port: 4000, icon: '🔌' },
                ],
              },
              processes: { pm2: [], services: [] },
              isLocal: true,
            },
            draggable: true,
          });
        } else {
          const container = (svc as { container: ContainerData }).container;
          const meta = getStackMeta(container.image, container.name);
          newNodes.push({
            id: svc.id,
            type: 'container',
            position: { x: infraStartX + i * COL_GAP, y: infraY },
            data: {
              label: meta.label || container.name,
              image: container.image,
              status: container.liveStatus,
              ports: container.ports,
              meta,
              processes: processMap[container.id] || { pm2: [], services: [] },
              isInfra: true,
            },
            draggable: true,
          });
        }
        addEdge({ id: `host-${svc.id}`, source: 'host', target: svc.id, style: { stroke: '#64748b', strokeWidth: 2 } });
      });

      // control → infra-db 점선 연결
      const infraDbNode = infraContainers.find((c) => c.name.includes('infra-db'));
      if (infraDbNode) {
        addEdge({
          id: 'control-db',
          source: 'local-control',
          target: `container-${infraDbNode.id}`,
          style: { stroke: '#38bdf8', strokeWidth: 1.5, strokeDasharray: '6 3' },
        });
      }

      // ══════ Row 3: Nginx Sites — 앱 컨테이너와 같은 컬럼 ══════
      const nginxY = ROW_GAP * 3.1;
      const nginxContainer = infraContainers.find((c) => c.name.includes('nginx'));
      const nginxNodeId = nginxContainer ? `container-${nginxContainer.id}` : null;

      sortedSites.forEach((site, i) => {
        const id = `nginx-${site.name}`;
        newNodes.push({ id, type: 'nginx', position: { x: rowStartX + i * COL_GAP, y: nginxY }, data: { ...site } as Record<string, unknown>, draggable: true });
        if (nginxNodeId) {
          const isStorage = site.name.includes('minio') || site.name.includes('bucket');
          addEdge({ id: `${nginxNodeId}-${id}`, source: nginxNodeId, target: id, style: { stroke: isStorage ? '#e11d48' : '#d97706', strokeWidth: 1.5 } });
        }
      });

      // control.kscold.com → kscold-control 연결
      if (sites.find((s) => s.name === 'control')) {
        addEdge({ id: 'nginx-control-local', source: 'nginx-control', target: 'local-control', animated: true, style: { stroke: '#22d3ee', strokeWidth: 1.5 } });
      }

      // ══════ Row 4: 앱 컨테이너 — site와 정확히 같은 컬럼 ══════
      const containerY = ROW_GAP * 4.3;
      appContainers.forEach((container, i) => {
        const id = `container-${container.id}`;
        const meta = getStackMeta(container.image, container.name);
        newNodes.push({
          id,
          type: 'container',
          position: { x: rowStartX + i * COL_GAP, y: containerY },
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

        // site → 앱 컨테이너 연결 (같은 컬럼 = 수직 직선)
        sortedSites.forEach((site) => {
          if (siteToApp.get(site.name) === container.id) {
            addEdge({ id: `nginx-${site.name}-${id}`, source: `nginx-${site.name}`, target: id, animated: site.enabled, style: { stroke: site.enabled ? '#22c55e' : '#4b5563', strokeWidth: 1.5 } });
          }
        });
      });

      setNodes(newNodes);
      setEdges(newEdges);
    },
    [setNodes, setEdges],
  );

  // process 데이터만 targeted 업데이트 (전체 그래프 재빌드 방지)
  const updateProcesses = useCallback(
    (containers: ContainerData[], processMap: Record<string, ContainerProcesses>) => {
      const containerById = new Map(containers.map((c) => [`container-${c.id}`, c]));
      setNodes((prev) =>
        prev.map((node) => {
          if (node.type !== 'container') return node;
          const container = containerById.get(node.id);
          if (!container) return node;
          const processes = processMap[container.id] || { pm2: [], services: [] };
          return { ...node, data: { ...node.data, processes } };
        }),
      );
    },
    [setNodes],
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

      // 1차: 그래프 구조 렌더링 (process 없이 즉시 표시)
      buildGraph(containers, sites, upnpMappings, {});
      setLoading(false);
      setProcessesLoading(true);

      // 2차: process 데이터만 targeted 업데이트 (전체 재빌드 없음)
      const processMap = await fetchProcesses(containers);
      updateProcesses(containers, processMap);
    } catch (e) {
      console.error('Topology load failed', e);
    } finally {
      setLoading(false);
      setProcessesLoading(false);
    }
  }, [buildGraph, fetchProcesses, updateProcesses]);

  useEffect(() => { loadTopology(); }, [loadTopology]);

  return {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    loading,
    processesLoading,
    loadTopology,
  };
}
