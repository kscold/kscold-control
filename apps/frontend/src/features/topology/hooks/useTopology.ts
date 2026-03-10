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
      const COL_GAP = 280;
      const ROW_GAP = 180;
      const totalWidth = Math.max(containers.length, sites.length, 3) * COL_GAP;
      const centerX = totalWidth / 2;

      const addEdge = (edge: Edge) => {
        if (!edgeIdSet.has(edge.id)) {
          edgeIdSet.add(edge.id);
          newEdges.push(edge);
        }
      };

      // Internet
      newNodes.push({ id: 'internet', type: 'internet', position: { x: centerX - 80, y: 0 }, data: { label: 'Internet' }, draggable: true });

      // Host
      newNodes.push({ id: 'host', type: 'host', position: { x: centerX - 110, y: ROW_GAP }, data: { label: 'Mac Mini', subtitle: 'Apple Silicon · Colima' }, draggable: true });
      addEdge({ id: 'internet-host', source: 'internet', target: 'host', animated: true, style: { stroke: '#6366f1', strokeWidth: 2 } });

      // UPnP
      const localUpnp = upnpMappings.filter((m) => m.local);
      if (localUpnp.length > 0) {
        const startX = centerX - ((localUpnp.length - 1) * COL_GAP) / 2 - 65;
        localUpnp.forEach((m, i) => {
          const id = `upnp-${m.publicPort}-${m.protocol}`;
          newNodes.push({ id, type: 'upnp', position: { x: startX + i * COL_GAP, y: ROW_GAP * 2 }, data: { publicPort: m.publicPort, privatePort: m.privatePort, protocol: m.protocol, description: m.description }, draggable: true });
          addEdge({ id: `host-${id}`, source: 'host', target: id, style: { stroke: '#a855f7', strokeWidth: 1.5 } });
        });
      }

      // Nginx sites
      const nginxY = ROW_GAP * (localUpnp.length > 0 ? 3 : 2);
      const nginxStartX = centerX - ((sites.length - 1) * COL_GAP) / 2 - 90;
      sites.forEach((site, i) => {
        const id = `nginx-${site.name}`;
        newNodes.push({ id, type: 'nginx', position: { x: nginxStartX + i * COL_GAP, y: nginxY }, data: { ...site } as Record<string, unknown>, draggable: true });
        addEdge({ id: `host-${id}`, source: 'host', target: id, style: { stroke: '#d97706', strokeWidth: 1.5 } });
        localUpnp.forEach((m) => {
          if (m.privatePort === 80 || m.privatePort === 443) {
            addEdge({ id: `upnp-${m.publicPort}-${m.protocol}-${id}`, source: `upnp-${m.publicPort}-${m.protocol}`, target: id, style: { stroke: '#a855f7', strokeWidth: 1, strokeDasharray: '4 4' } });
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
            addEdge({ id: `nginx-${site.name}-${id}`, source: `nginx-${site.name}`, target: id, animated: site.enabled, style: { stroke: site.enabled ? '#22c55e' : '#4b5563', strokeWidth: 1.5 } });
          }
        });

        localUpnp.forEach((m) => {
          Object.entries(container.ports || {}).forEach(([internal, external]) => {
            const extPort = parseInt(String(external), 10);
            if (m.privatePort === extPort || m.publicPort === extPort) {
              addEdge({ id: `upnp-${m.publicPort}-${m.protocol}-${id}-${internal}`, source: `upnp-${m.publicPort}-${m.protocol}`, target: id, style: { stroke: '#a855f7', strokeWidth: 1, strokeDasharray: '4 4' } });
            }
          });
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
