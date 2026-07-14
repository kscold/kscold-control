import { Inject, Injectable } from '@nestjs/common';
import { ComposeService } from './compose.service';
import type {
  TopologySnapshot,
  TopologySnapshotEdge,
  TopologySnapshotNode,
} from '../../domain/types/topology-snapshot.type';
import type { NginxSite } from '../../../nginx/domain/types/nginx-site.type';
import {
  NGINX_CONFIG_REPOSITORY,
  type INginxConfigRepository,
} from '../../../nginx/domain/repositories/nginx-config.repository';
import { ListContainersUseCase } from '../use-cases';
import type { ContainerResponseDto } from '../dto/container-response.dto';
import {
  DOCKER_CLIENT,
  type IDockerClient,
} from '../../domain/repositories/docker-client.interface';
import {
  ITopologyLayoutRepository,
  TOPOLOGY_LAYOUT_REPOSITORY,
} from '../../domain/repositories/topology-layout.repository.interface';

type RuntimeProcesses = {
  pm2: any[];
  services: Array<{ name: string; port: number; icon: string }>;
};

interface StackMeta {
  label: string;
  type: 'app' | 'db' | 'proxy' | 'cache' | 'storage';
  color: string;
  shadowColor: string;
  headerBg: string;
  stacks: Array<{ name: string; badge: string; color: string }>;
  knownServices: Array<{ name: string; port: number; icon: string }>;
}

interface ContainerGatewayInfo {
  mode: 'host-nginx' | 'container-nginx' | 'direct';
  label: string;
  details: string[];
}

interface AppColumnEntry {
  container: ContainerResponseDto;
  columnIndex: number;
  yOffset?: number;
  companionParentName?: string;
}

interface TopologyNodePositionInput {
  nodeId: string;
  x: number;
  y: number;
}

const COL_GAP = 400;
const NODE_HALF_W = 110;
const INTERNET_Y = 0;
const HOST_Y = 180;
const INFRA_Y = 410;
const SITE_Y = 800;
const APP_Y = 1160;
const INFERRED_SITE_HINTS: NginxSite[] = [
  {
    name: 'control',
    domain: 'control.kscold.com',
    upstream: 'http://host.docker.internal:4000',
    ssl: true,
    sslCert: '',
    sslKey: '',
    websocket: true,
    enabled: true,
    source: 'inferred',
  },
  {
    name: 'slacord',
    domain: 'slacord.cloud',
    upstream: 'http://ubuntu-slacord:3002',
    ssl: true,
    sslCert: '',
    sslKey: '',
    websocket: true,
    enabled: true,
    source: 'inferred',
  },
  {
    name: 'blog-main',
    domain: 'kscold.com',
    upstream: 'http://ubuntu-blog:3000',
    ssl: true,
    sslCert: '',
    sslKey: '',
    websocket: true,
    enabled: true,
    source: 'inferred',
  },
  {
    name: 'congbang',
    domain: 'congbang.kscold.com',
    upstream: 'http://ubuntu-congbang:3000',
    ssl: true,
    sslCert: '',
    sslKey: '',
    websocket: true,
    enabled: true,
    source: 'inferred',
  },
  {
    name: 'galjido',
    domain: 'galjido.kscold.com',
    upstream: 'http://ubuntu-galjido:8080',
    ssl: true,
    sslCert: '',
    sslKey: '',
    websocket: false,
    enabled: true,
    source: 'inferred',
  },
];

@Injectable()
export class DockerTopologyService {
  constructor(
    private readonly composeService: ComposeService,
    private readonly listContainersUseCase: ListContainersUseCase,
    @Inject(NGINX_CONFIG_REPOSITORY)
    private readonly nginxConfigRepository: INginxConfigRepository,
    @Inject(DOCKER_CLIENT) private readonly dockerClient: IDockerClient,
    @Inject(TOPOLOGY_LAYOUT_REPOSITORY)
    private readonly topologyLayoutRepository: ITopologyLayoutRepository,
  ) {}

  async getSnapshot(userId: string): Promise<TopologySnapshot> {
    const [containers, configuredSites] = await Promise.all([
      this.listContainersUseCase.execute(undefined),
      this.nginxConfigRepository.list(),
    ]);
    // server_name(도메인)이 없는 설정(예: ip-blocklist.conf 같은 공용 include)은
    // 토폴로지의 사이트 노드가 아니므로 제외한다. (이름 없는 빈 노드로 렌더되던 버그)
    const sites = this.mergeSites(configuredSites, containers).filter(
      (site) => site.domain && site.domain.trim().length > 0,
    );

    const processMap = await this.fetchProcesses(containers);
    const composeServices = new Set(this.composeService.listServices());
    const nodes: TopologySnapshotNode[] = [];
    const edges: TopologySnapshotEdge[] = [];
    const edgeIds = new Set<string>();

    const addEdge = (edge: TopologySnapshotEdge) => {
      if (edgeIds.has(edge.id)) {
        return;
      }

      edgeIds.add(edge.id);
      edges.push(edge);
    };

    const containerNodeMap = new Map<string, string>();
    const serviceNodeIds = new Set<string>();

    const infraContainers = containers.filter((container) =>
      this.isInfraContainer(container),
    );
    const appContainers = containers.filter(
      (container) => !this.isInfraContainer(container),
    );
    const sortedSites = this.sortSites(sites, appContainers);
    const appColumns = this.buildAppColumns(appContainers, sortedSites);
    const nginxContainer = infraContainers.find((container) =>
      container.name.includes('nginx'),
    );
    const nginxContainers = infraContainers.filter((container) =>
      container.name.includes('nginx'),
    );
    const dbContainers = infraContainers.filter(
      (container) => !container.name.includes('nginx'),
    );

    const infraNodes: Array<{
      id: string;
      label: string;
      container?: ContainerResponseDto;
    }> = [
      ...nginxContainers.map((container) => ({
        id: `container-${container.id}`,
        label: container.name,
        container,
      })),
      { id: 'local-control', label: 'kscold-control' },
      ...dbContainers.map((container) => ({
        id: `container-${container.id}`,
        label: container.name,
        container,
      })),
    ];

    const maxColumnIndex = Math.max(
      sortedSites.length - 1,
      ...appColumns.map((entry) => entry.columnIndex),
      4,
    );
    const totalColumns = Math.ceil(maxColumnIndex) + 1;
    const totalWidth = totalColumns * COL_GAP;
    const centerX = totalWidth / 2;
    const rowStartX =
      centerX - ((totalColumns - 1) * COL_GAP) / 2 - NODE_HALF_W;

    nodes.push({
      id: 'internet',
      type: 'internet',
      position: { x: centerX - 80, y: INTERNET_Y },
      data: { label: 'Internet' },
      draggable: true,
    });

    nodes.push({
      id: 'host',
      type: 'host',
      position: { x: centerX - 110, y: HOST_Y },
      data: {
        label: 'Mac Mini (Host)',
        subtitle: 'macOS · Colima · Docker · PM2',
      },
      draggable: true,
    });

    addEdge({
      id: 'internet-host',
      source: 'internet',
      target: 'host',
      animated: true,
      style: { stroke: '#6366f1', strokeWidth: 2 },
    });

    const infraStartX =
      centerX - ((infraNodes.length - 1) * COL_GAP) / 2 - NODE_HALF_W;
    infraNodes.forEach((entry, index) => {
      if (!entry.container) {
        const domains = this.getLocalControlDomains(sites);
        nodes.push({
          id: entry.id,
          type: 'container',
          position: { x: infraStartX + index * COL_GAP, y: INFRA_Y },
          data: {
            label: entry.label,
            image: 'local (PM2)',
            status: 'running',
            ports: { '4000': 4000 },
            meta: this.getLocalControlMeta(),
            processes: { pm2: [], services: [] },
            isLocal: true,
            domains,
            gateway: this.buildLocalGateway(domains),
          },
          draggable: true,
        });
      } else {
        const meta = this.getStackMeta(
          entry.container.image,
          entry.container.name,
        );
        const processes = processMap[entry.container.id] ?? {
          pm2: [],
          services: [],
        };
        const domains = this.getContainerDomains(entry.container, sites);
        const gateway = this.buildContainerGateway(
          entry.container,
          processes.services,
          domains,
        );
        nodes.push({
          id: entry.id,
          type: 'container',
          position: { x: infraStartX + index * COL_GAP, y: INFRA_Y },
          data: {
            label: meta.label || entry.container.name,
            image: entry.container.image,
            status: entry.container.liveStatus,
            ports: entry.container.ports,
            meta,
            processes,
            isInfra: true,
            domains,
            gateway,
          },
          draggable: true,
        });

        containerNodeMap.set(entry.container.name, entry.id);
        this.addServiceNodes(
          nodes,
          addEdge,
          serviceNodeIds,
          entry.id,
          processes.services,
          infraStartX + index * COL_GAP,
          INFRA_Y,
        );
      }

      addEdge({
        id: `host-${entry.id}`,
        source: 'host',
        target: entry.id,
        style: { stroke: '#64748b', strokeWidth: 2 },
      });
    });

    sortedSites.forEach((site, index) => {
      const nodeId = `nginx-${site.name}`;
      nodes.push({
        id: nodeId,
        type: 'nginx',
        position: { x: rowStartX + index * COL_GAP, y: SITE_Y },
        data: {
          ...site,
          source: site.source ?? 'config',
        },
        draggable: true,
      });

      if (nginxContainer) {
        addEdge({
          id: `container-${nginxContainer.id}-${nodeId}`,
          source: `container-${nginxContainer.id}`,
          target: nodeId,
          style: { stroke: '#d97706', strokeWidth: 1.5 },
        });
      }
    });

    appColumns.forEach(
      ({ container, columnIndex, yOffset, companionParentName }) => {
        const meta = this.getStackMeta(container.image, container.name);
        const processes = processMap[container.id] ?? { pm2: [], services: [] };
        const domains = this.getContainerDomains(container, sites);
        const gateway = this.buildContainerGateway(
          container,
          processes.services,
          domains,
        );
        const nodeId = `container-${container.id}`;
        const x = rowStartX + columnIndex * COL_GAP;
        const y = APP_Y + (yOffset ?? 0);

        nodes.push({
          id: nodeId,
          type: 'container',
          position: { x, y },
          data: {
            label: meta.label || container.name,
            image: container.image,
            status: container.liveStatus,
            ports: container.ports,
            meta,
            processes,
            composeManaged: composeServices.has(container.name),
            domains,
            gateway,
          },
          draggable: true,
        });

        containerNodeMap.set(container.name, nodeId);
        addEdge({
          id: `host-${nodeId}`,
          source: 'host',
          target: nodeId,
          style: {
            stroke: '#334155',
            strokeWidth: 1.5,
            strokeDasharray: '6 3',
          },
        });
        this.addServiceNodes(
          nodes,
          addEdge,
          serviceNodeIds,
          nodeId,
          processes.services,
          x,
          y,
        );

        if (companionParentName) {
          const parentNodeId = containerNodeMap.get(companionParentName);
          if (parentNodeId) {
            addEdge({
              id: `${parentNodeId}-${nodeId}`,
              source: parentNodeId,
              target: nodeId,
              animated: container.liveStatus === 'running',
              style: {
                stroke: '#8b5cf6',
                strokeWidth: 1.5,
                strokeDasharray: '5 3',
              },
            });
          }
        }
      },
    );

    for (const site of sortedSites) {
      const target = this.resolveUpstreamTarget(
        site,
        containers,
        containerNodeMap,
      );
      if (!target) {
        continue;
      }

      addEdge({
        id: `nginx-${site.name}-${target}`,
        source: `nginx-${site.name}`,
        target,
        animated: site.enabled,
        style: {
          stroke: target === 'local-control' ? '#22d3ee' : '#22c55e',
          strokeWidth: 1.5,
        },
      });
    }

    await this.applyStoredNodePositions(userId, nodes);

    return {
      nodes,
      edges,
      summary: {
        generatedAt: Date.now(),
        containerCount: containers.length,
        siteCount: sites.length,
        serviceNodeCount: serviceNodeIds.size,
      },
    };
  }

  async saveNodePositions(
    userId: string,
    positions: TopologyNodePositionInput[],
  ): Promise<void> {
    if (!userId) {
      throw new Error('A user ID is required to save topology layout.');
    }

    const sanitizedPositions = positions.filter(
      (position) =>
        position.nodeId.trim().length > 0 &&
        Number.isFinite(position.x) &&
        Number.isFinite(position.y),
    );

    if (sanitizedPositions.length === 0) {
      return;
    }

    await this.topologyLayoutRepository.upsertPositions(
      userId,
      sanitizedPositions.map((position) => ({
        nodeId: position.nodeId.trim(),
        x: position.x,
        y: position.y,
      })),
    );
  }

  private async applyStoredNodePositions(
    userId: string,
    nodes: TopologySnapshotNode[],
  ): Promise<void> {
    const rows = await this.topologyLayoutRepository.findPositionsByUser(userId);
    const positions = new Map<string, { x: number; y: number }>(
      rows.map((row) => [row.nodeId, { x: row.x, y: row.y }]),
    );

    nodes.forEach((node) => {
      const position = positions.get(node.id);
      if (
        position &&
        Number.isFinite(position.x) &&
        Number.isFinite(position.y)
      ) {
        node.position = position;
      }
    });
  }

  private mergeSites(
    configuredSites: NginxSite[],
    containers: ContainerResponseDto[],
  ): NginxSite[] {
    const merged = new Map<string, NginxSite>();

    configuredSites.forEach((site) => {
      merged.set(site.domain, {
        ...site,
        source: site.source ?? 'config',
      });
    });

    INFERRED_SITE_HINTS.forEach((hint) => {
      if (!this.isHintRelevant(hint, containers)) {
        return;
      }

      if (merged.has(hint.domain)) {
        return;
      }

      merged.set(hint.domain, hint);
    });

    return Array.from(merged.values());
  }

  private isHintRelevant(
    hint: NginxSite,
    containers: ContainerResponseDto[],
  ): boolean {
    if (this.isLocalControlUpstream(hint.upstream)) {
      return true;
    }

    return containers.some((container) =>
      this.matchesUpstreamHost(hint.upstream, container.name),
    );
  }

  private async fetchProcesses(
    containers: ContainerResponseDto[],
  ): Promise<Record<string, RuntimeProcesses>> {
    const entries = await Promise.all(
      containers
        .filter(
          (container) =>
            container.liveStatus === 'running' && container.dockerId,
        )
        .map(async (container) => {
          try {
            const processes = await this.dockerClient.getContainerProcesses(
              container.dockerId,
            );
            return [container.id, processes] as const;
          } catch {
            return [container.id, { pm2: [], services: [] }] as const;
          }
        }),
    );

    return Object.fromEntries(entries);
  }

  private isInfraContainer(container: ContainerResponseDto): boolean {
    return (
      container.name.includes('nginx') || container.name.includes('infra-db')
    );
  }

  private sortSites(
    sites: NginxSite[],
    appContainers: ContainerResponseDto[],
  ): NginxSite[] {
    const appLinked = sites.filter((site) =>
      appContainers.some((container) =>
        this.matchesUpstreamHost(site.upstream, container.name),
      ),
    );
    const controlSites = sites.filter((site) =>
      this.isLocalControlUpstream(site.upstream),
    );
    const storageSites = sites.filter((site) => this.isStorageSite(site));
    const seen = new Set<string>();

    return [...appLinked, ...controlSites, ...storageSites, ...sites].filter(
      (site) => {
        if (seen.has(site.name)) {
          return false;
        }

        seen.add(site.name);
        return true;
      },
    );
  }

  private buildAppColumns(
    appContainers: ContainerResponseDto[],
    sortedSites: NginxSite[],
  ): AppColumnEntry[] {
    const usedContainerIds = new Set<string>();
    const alignedEntries: AppColumnEntry[] = [];
    const columnByContainerName = new Map<string, number>();

    sortedSites.forEach((site, columnIndex) => {
      const matchedContainer = appContainers.find(
        (container) =>
          !usedContainerIds.has(container.id) &&
          this.matchesUpstreamHost(site.upstream, container.name),
      );

      if (!matchedContainer) {
        return;
      }

      usedContainerIds.add(matchedContainer.id);
      columnByContainerName.set(matchedContainer.name, columnIndex);
      alignedEntries.push({
        container: matchedContainer,
        columnIndex,
      });
    });

    const companionEntries = appContainers
      .filter((container) => !usedContainerIds.has(container.id))
      .map((container) => {
        const parentName = this.getCompanionParentName(container.name);
        return parentName
          ? {
              container,
              parentName,
              order: this.getCompanionOrder(container.name),
            }
          : null;
      })
      .filter(
        (
          entry,
        ): entry is {
          container: ContainerResponseDto;
          parentName: string;
          order: number;
        } => entry !== null && columnByContainerName.has(entry.parentName),
      )
      .sort((left, right) => left.order - right.order)
      .map((entry, index) => {
        usedContainerIds.add(entry.container.id);
        return {
          container: entry.container,
          columnIndex:
            columnByContainerName.get(entry.parentName)! + 0.72 + index * 0.72,
          yOffset: 145,
          companionParentName: entry.parentName,
        };
      });

    const orphanContainers = appContainers.filter(
      (container) => !usedContainerIds.has(container.id),
    );

    return [
      ...alignedEntries,
      ...companionEntries,
      ...orphanContainers.map((container, index) => ({
        container,
        columnIndex: sortedSites.length + index,
      })),
    ];
  }

  private getCompanionParentName(containerName: string): string | null {
    const normalizedName = containerName.toLowerCase();

    if (
      normalizedName.includes('vault-agent') ||
      normalizedName.includes('blog-agent') ||
      normalizedName.includes('vault-qdrant') ||
      normalizedName.includes('blog-qdrant')
    ) {
      return 'ubuntu-blog';
    }

    return null;
  }

  private getCompanionOrder(containerName: string): number {
    const normalizedName = containerName.toLowerCase();

    if (normalizedName.includes('agent')) return 0;
    if (normalizedName.includes('qdrant')) return 1;
    return 10;
  }

  private resolveUpstreamTarget(
    site: NginxSite,
    containers: ContainerResponseDto[],
    containerNodeMap: Map<string, string>,
  ): string | null {
    if (this.isLocalControlUpstream(site.upstream) || site.name === 'control') {
      return 'local-control';
    }

    const upstreamHost = this.extractUpstreamHost(site.upstream);
    const container = containers.find((entry) =>
      this.matchesUpstreamHost(site.upstream, entry.name),
    );
    if (container) {
      return containerNodeMap.get(container.name) ?? null;
    }

    if (upstreamHost && containerNodeMap.has(upstreamHost)) {
      return containerNodeMap.get(upstreamHost) ?? null;
    }

    return null;
  }

  private extractUpstreamHost(upstream: string): string | null {
    try {
      const url = new URL(upstream);
      return url.hostname;
    } catch {
      return null;
    }
  }

  private matchesUpstreamHost(
    upstream: string,
    containerName: string,
  ): boolean {
    const upstreamHost = this.extractUpstreamHost(upstream);
    return (
      upstreamHost === containerName ||
      upstreamHost === containerName.replace('ubuntu-', '')
    );
  }

  private isLocalControlUpstream(upstream: string): boolean {
    const host = this.extractUpstreamHost(upstream);
    return (
      host === 'host.docker.internal' ||
      host === 'localhost' ||
      host === '127.0.0.1'
    );
  }

  private isStorageSite(site: NginxSite): boolean {
    const target = `${site.name} ${site.domain} ${site.upstream}`.toLowerCase();
    return (
      target.includes('minio') ||
      target.includes('bucket') ||
      target.includes('9000')
    );
  }

  private getContainerDomains(
    container: ContainerResponseDto,
    sites: NginxSite[],
  ): string[] {
    return sites
      .filter((site) => this.matchesUpstreamHost(site.upstream, container.name))
      .map((site) => site.domain);
  }

  private getLocalControlDomains(sites: NginxSite[]): string[] {
    return sites
      .filter(
        (site) =>
          this.isLocalControlUpstream(site.upstream) || site.name === 'control',
      )
      .map((site) => site.domain);
  }

  private buildLocalGateway(domains: string[]): ContainerGatewayInfo {
    return {
      mode: domains.length > 0 ? 'host-nginx' : 'direct',
      label: domains.length > 0 ? '공용 kscold-nginx 프록시' : '직접 접근',
      details:
        domains.length > 0
          ? [
              '실제 도메인은 공용 kscold-nginx가 host.docker.internal:4000으로 프록시합니다.',
              'kscold-control은 컨테이너가 아니라 호스트 PM2 프로세스로 실행 중입니다.',
            ]
          : ['현재 연결된 공용 도메인을 찾지 못했습니다.'],
    };
  }

  private buildContainerGateway(
    container: ContainerResponseDto,
    services: Array<{ name: string; port: number; icon: string }>,
    domains: string[],
  ): ContainerGatewayInfo {
    const hasInternalNginx = services.some((service) =>
      service.name.toLowerCase().includes('nginx'),
    );
    const upstreamPort = this.resolvePrimaryInternalPort(container.ports);

    if (hasInternalNginx) {
      return {
        mode: 'container-nginx',
        label: '컨테이너 내부 Nginx',
        details: [
          '컨테이너 내부에서 Nginx 프로세스가 감지되었습니다.',
          upstreamPort
            ? `대표 웹 포트는 :${upstreamPort} 기준으로 보입니다.`
            : '대표 웹 포트를 찾지 못했습니다.',
        ],
      };
    }

    if (domains.length > 0) {
      return {
        mode: 'host-nginx',
        label: '공용 kscold-nginx 프록시',
        details: [
          '실제 웹 도메인은 공용 kscold-nginx가 앞단에서 종료합니다.',
          '이 Ubuntu 컨테이너 안에는 별도 Nginx가 없고, 앱 포트만 직접 노출됩니다.',
          upstreamPort
            ? `대표 업스트림 포트는 :${upstreamPort} 입니다.`
            : '대표 업스트림 포트를 찾지 못했습니다.',
        ],
      };
    }

    return {
      mode: 'direct',
      label: '직접 노출 포트',
      details: [
        '현재 공용 도메인 연결은 감지되지 않았습니다.',
        upstreamPort
          ? `대표 포트는 :${upstreamPort} 입니다.`
          : '대표 포트를 찾지 못했습니다.',
      ],
    };
  }

  private resolvePrimaryInternalPort(
    ports: Record<string, number>,
  ): string | null {
    const priority = (value: string) => {
      if (value === '80' || value === '443') return 0;
      if (value === '3000' || value === '3001' || value === '3002') return 1;
      if (value === '8080' || value === '8081' || value === '8082') return 2;
      if (value === '22') return 99;
      return 10;
    };

    const sortedPorts = Object.keys(ports).sort(
      (left, right) => priority(left) - priority(right),
    );

    return sortedPorts[0] ?? null;
  }

  private addServiceNodes(
    nodes: TopologySnapshotNode[],
    addEdge: (edge: TopologySnapshotEdge) => void,
    serviceNodeIds: Set<string>,
    containerNodeId: string,
    services: Array<{ name: string; port: number; icon: string }>,
    containerX: number,
    containerY: number,
  ) {
    services.forEach((service, index) => {
      const nodeId = `${containerNodeId}-service-${service.name}-${service.port}`;
      serviceNodeIds.add(nodeId);
      nodes.push({
        id: nodeId,
        type: 'service',
        position: {
          x: containerX + index * 130,
          y: containerY + 185,
        },
        data: {
          label: service.name,
          port: service.port,
          icon: service.icon,
        },
        draggable: true,
      });

      addEdge({
        id: `${containerNodeId}-${nodeId}`,
        source: containerNodeId,
        target: nodeId,
        style: { stroke: '#8b5cf6', strokeWidth: 1.25, strokeDasharray: '4 2' },
      });
    });
  }

  private getLocalControlMeta(): StackMeta {
    return {
      label: 'kscold-control',
      type: 'app',
      color: 'border-cyan-500',
      shadowColor: 'shadow-cyan-500/20',
      headerBg: 'bg-cyan-950',
      stacks: [
        {
          name: 'NestJS',
          badge: 'Node.js',
          color: 'bg-cyan-900 text-cyan-300',
        },
        { name: 'PM2', badge: 'Local', color: 'bg-gray-700 text-gray-300' },
      ],
      knownServices: [
        { name: 'API', port: 4000, icon: '⚡' },
        { name: 'WebSocket', port: 4000, icon: '🔌' },
      ],
    };
  }

  private getStackMeta(image: string, containerName: string): StackMeta {
    const normalizedImage = image.toLowerCase();
    const normalizedName = containerName.toLowerCase();

    if (
      normalizedName.includes('vault-agent') ||
      normalizedName.includes('blog-agent')
    ) {
      return {
        label: 'Vault Agent',
        type: 'app',
        color: 'border-violet-500',
        shadowColor: 'shadow-violet-500/20',
        headerBg: 'bg-violet-950',
        stacks: [
          {
            name: 'LangGraph',
            badge: 'Agent',
            color: 'bg-violet-900 text-violet-300',
          },
          {
            name: 'gRPC',
            badge: ':9090',
            color: 'bg-sky-900 text-sky-300',
          },
        ],
        knownServices: [{ name: 'Vault Agent', port: 9090, icon: 'agent' }],
      };
    }

    if (
      normalizedImage.includes('qdrant') ||
      normalizedName.includes('qdrant')
    ) {
      return {
        label: 'Vault Qdrant',
        type: 'storage',
        color: 'border-cyan-500',
        shadowColor: 'shadow-cyan-500/20',
        headerBg: 'bg-cyan-950',
        stacks: [
          {
            name: 'Qdrant',
            badge: 'Vector DB',
            color: 'bg-cyan-900 text-cyan-300',
          },
        ],
        knownServices: [{ name: 'Qdrant', port: 6333, icon: 'vector' }],
      };
    }

    if (
      normalizedImage.includes('slacord') ||
      normalizedName.includes('slacord')
    ) {
      return {
        label: 'Slacord',
        type: 'app',
        color: 'border-emerald-500',
        shadowColor: 'shadow-emerald-500/20',
        headerBg: 'bg-emerald-950',
        stacks: [
          {
            name: 'NestJS',
            badge: 'API',
            color: 'bg-emerald-900 text-emerald-300',
          },
          { name: 'Next.js', badge: 'Web', color: 'bg-blue-900 text-blue-300' },
          {
            name: 'PM2',
            badge: 'Process',
            color: 'bg-indigo-900 text-indigo-300',
          },
        ],
        knownServices: [],
      };
    }

    if (normalizedImage.includes('blog') || normalizedName.includes('blog')) {
      return {
        label: 'Blog',
        type: 'app',
        color: 'border-violet-500',
        shadowColor: 'shadow-violet-500/20',
        headerBg: 'bg-violet-950',
        stacks: [
          {
            name: 'Spring Boot',
            badge: 'API',
            color: 'bg-violet-900 text-violet-300',
          },
          {
            name: 'Next.js',
            badge: 'Web',
            color: 'bg-green-900 text-green-300',
          },
        ],
        knownServices: [],
      };
    }

    if (
      normalizedImage.includes('congbang') ||
      normalizedName.includes('congbang')
    ) {
      return {
        label: 'CongBang',
        type: 'app',
        color: 'border-blue-500',
        shadowColor: 'shadow-blue-500/20',
        headerBg: 'bg-blue-950',
        stacks: [
          {
            name: 'Spring Boot',
            badge: 'Java',
            color: 'bg-orange-900 text-orange-300',
          },
          {
            name: 'Next.js',
            badge: 'Node',
            color: 'bg-green-900 text-green-300',
          },
          {
            name: 'PM2',
            badge: 'Process',
            color: 'bg-indigo-900 text-indigo-300',
          },
        ],
        knownServices: [],
      };
    }

    if (
      normalizedImage.includes('galjido') ||
      normalizedName.includes('galjido')
    ) {
      return {
        label: 'Galjido',
        type: 'app',
        color: 'border-purple-500',
        shadowColor: 'shadow-purple-500/20',
        headerBg: 'bg-purple-950',
        stacks: [
          {
            name: 'Ubuntu',
            badge: '22.04',
            color: 'bg-orange-900 text-orange-300',
          },
          { name: 'OpenSSH', badge: ':22', color: 'bg-gray-700 text-gray-300' },
        ],
        knownServices: [],
      };
    }

    if (
      normalizedImage.includes('postgres') ||
      normalizedName.includes('postgres') ||
      normalizedName.includes('infra-db')
    ) {
      return {
        label: 'PostgreSQL',
        type: 'db',
        color: 'border-sky-500',
        shadowColor: 'shadow-sky-500/20',
        headerBg: 'bg-sky-950',
        stacks: [
          {
            name: 'PostgreSQL 15',
            badge: 'Alpine',
            color: 'bg-sky-900 text-sky-300',
          },
        ],
        knownServices: [{ name: 'PostgreSQL', port: 5432, icon: '🐘' }],
      };
    }

    if (normalizedImage.includes('nginx') || normalizedName.includes('nginx')) {
      return {
        label: 'Nginx Proxy',
        type: 'proxy',
        color: 'border-amber-500',
        shadowColor: 'shadow-amber-500/20',
        headerBg: 'bg-amber-950',
        stacks: [
          {
            name: 'Nginx',
            badge: 'Reverse Proxy',
            color: 'bg-amber-900 text-amber-300',
          },
          {
            name: 'SSL/TLS',
            badge: 'Ingress',
            color: 'bg-green-900 text-green-300',
          },
        ],
        knownServices: [{ name: 'HTTP', port: 80, icon: '🌐' }],
      };
    }

    if (normalizedImage.includes('mongo')) {
      return {
        label: 'MongoDB',
        type: 'db',
        color: 'border-green-500',
        shadowColor: 'shadow-green-500/20',
        headerBg: 'bg-green-950',
        stacks: [
          {
            name: 'MongoDB',
            badge: 'NoSQL',
            color: 'bg-green-900 text-green-300',
          },
        ],
        knownServices: [{ name: 'MongoDB', port: 27017, icon: '🍃' }],
      };
    }

    if (normalizedImage.includes('redis')) {
      return {
        label: 'Redis',
        type: 'cache',
        color: 'border-red-500',
        shadowColor: 'shadow-red-500/20',
        headerBg: 'bg-red-950',
        stacks: [
          { name: 'Redis', badge: 'Cache', color: 'bg-red-900 text-red-300' },
        ],
        knownServices: [{ name: 'Redis', port: 6379, icon: '🟥' }],
      };
    }

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
}
