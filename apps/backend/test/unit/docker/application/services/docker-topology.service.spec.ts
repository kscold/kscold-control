import { Test, TestingModule } from '@nestjs/testing';
import { DockerTopologyService } from '@/docker/application/services/docker-topology.service';
import { ComposeService } from '@/docker/application/services/compose.service';
import { ListContainersUseCase } from '@/docker/application/use-cases';
import {
  NGINX_CONFIG_REPOSITORY,
  type INginxConfigRepository,
} from '@/nginx/domain/repositories/nginx-config.repository';
import {
  DOCKER_CLIENT,
  type IDockerClient,
} from '@/docker/domain/gateways/docker-client.gateway.interface';
import {
  TOPOLOGY_LAYOUT_REPOSITORY,
  type ITopologyLayoutRepository,
} from '@/docker/domain/repositories/topology-layout.repository.interface';

describe('DockerTopologyService', () => {
  let service: DockerTopologyService;
  let layoutRepository: jest.Mocked<ITopologyLayoutRepository>;
  let listContainers: jest.Mocked<ListContainersUseCase>;
  let dockerClient: jest.Mocked<IDockerClient>;

  beforeEach(async () => {
    layoutRepository = {
      upsertPositions: jest.fn().mockResolvedValue(undefined),
      findPositionsByUser: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DockerTopologyService,
        {
          provide: ComposeService,
          useValue: {
            listServices: jest
              .fn()
              .mockReturnValue(['nginx', 'kscold-infra-db', 'ubuntu-blog']),
          },
        },
        {
          provide: ListContainersUseCase,
          useValue: {
            execute: jest.fn().mockResolvedValue([
              {
                id: 'infra-nginx',
                dockerId: 'dock-nginx',
                name: 'kscold-nginx',
                image: 'nginx:latest',
                status: 'running',
                liveStatus: 'running',
                ports: { '80': 80, '443': 443 },
                resources: { cpus: 1, memory: '256mb' },
                createdAt: new Date().toISOString(),
                isManaged: true,
              },
              {
                id: 'infra-db',
                dockerId: 'dock-db',
                name: 'kscold-infra-db',
                image: 'postgres:15-alpine',
                status: 'running',
                liveStatus: 'running',
                ports: { '5432': 5432 },
                resources: { cpus: 1, memory: '512mb' },
                createdAt: new Date().toISOString(),
                isManaged: true,
              },
              {
                id: 'blog-app',
                dockerId: 'dock-blog',
                name: 'ubuntu-blog',
                image: 'example/ubuntu-blog:latest',
                status: 'running',
                liveStatus: 'running',
                ports: { '3000': 3000, '22': 2224 },
                resources: { cpus: 2, memory: '2g' },
                createdAt: new Date().toISOString(),
                isManaged: true,
              },
              {
                id: 'blog-agent',
                dockerId: 'dock-blog-agent',
                name: 'kscold-vault-agent',
                image: 'kscold-vault-agent:test',
                status: 'running',
                liveStatus: 'running',
                ports: { '9090': 9090 },
                resources: { cpus: 1, memory: '512mb' },
                createdAt: new Date().toISOString(),
                isManaged: true,
              },
              {
                id: 'blog-qdrant',
                dockerId: 'dock-blog-qdrant',
                name: 'kscold-vault-qdrant',
                image: 'qdrant/qdrant:v1.10.1',
                status: 'running',
                liveStatus: 'running',
                ports: { '6333': 6333 },
                resources: { cpus: 1, memory: '512mb' },
                createdAt: new Date().toISOString(),
                isManaged: true,
              },
              {
                id: 'projectdelta-app',
                dockerId: 'dock-projectdelta',
                name: 'ubuntu-projectdelta',
                image: 'example/ubuntu-projectdelta:latest',
                status: 'running',
                liveStatus: 'running',
                ports: { '3002': 3003, '8082': 8084, '22': 2226 },
                resources: { cpus: 2, memory: '3g' },
                createdAt: new Date().toISOString(),
                isManaged: true,
              },
            ]),
          },
        },
        {
          provide: NGINX_CONFIG_REPOSITORY,
          useValue: {
            list: jest.fn().mockResolvedValue([
              {
                name: 'blog',
                domain: 'blog.example.com',
                upstream: 'http://ubuntu-blog:3000',
                ssl: true,
                sslCert: '',
                sslKey: '',
                websocket: true,
                enabled: true,
              },
              {
                name: 'control',
                domain: 'control.example.com',
                upstream: 'http://host.docker.internal:4000',
                ssl: true,
                sslCert: '',
                sslKey: '',
                websocket: true,
                enabled: true,
              },
              // 사이트 정보의 단일 출처는 nginx 설정이다.
              // 아래 두 사이트는 과거 서비스 내부 하드코딩 폴백에서 주입됐으나,
              // 실제 운영에서는 설정 파일(projectdelta.conf, example.com.conf)에 존재하므로
              // 목도 현실과 동일하게 맞춘다.
              {
                name: 'projectdelta',
                domain: 'projectdelta.example.com',
                upstream: 'http://ubuntu-projectdelta:3002',
                ssl: true,
                sslCert: '',
                sslKey: '',
                websocket: true,
                enabled: true,
              },
              {
                name: 'blog-main',
                domain: 'example.com',
                upstream: 'http://ubuntu-blog:3000',
                ssl: true,
                sslCert: '',
                sslKey: '',
                websocket: true,
                enabled: true,
              },
            ]),
          } satisfies Partial<INginxConfigRepository>,
        },
        {
          provide: DOCKER_CLIENT,
          useValue: {
            getContainerProcesses: jest
              .fn()
              .mockImplementation((dockerId: string) => {
                if (dockerId === 'dock-db') {
                  return Promise.resolve({
                    pm2: [],
                    services: [{ name: 'PostgreSQL', port: 5432, icon: 'pg' }],
                  });
                }

                if (dockerId === 'dock-blog') {
                  return Promise.resolve({
                    pm2: [
                      {
                        name: 'blog-api',
                        status: 'online',
                        cpu: 0,
                        memory: 0,
                        restarts: 0,
                      },
                    ],
                    services: [{ name: 'SSH', port: 22, icon: 'ssh' }],
                  });
                }

                if (dockerId === 'dock-projectdelta') {
                  return Promise.resolve({
                    pm2: [
                      {
                        name: 'projectdelta-backend',
                        status: 'online',
                        cpu: 0,
                        memory: 0,
                        restarts: 0,
                      },
                    ],
                    services: [{ name: 'MongoDB', port: 27017, icon: 'mongo' }],
                  });
                }

                if (dockerId === 'dock-blog-agent') {
                  return Promise.resolve({
                    pm2: [],
                    services: [
                      { name: 'Vault Agent', port: 9090, icon: 'agent' },
                    ],
                  });
                }

                if (dockerId === 'dock-blog-qdrant') {
                  return Promise.resolve({
                    pm2: [],
                    services: [{ name: 'Qdrant', port: 6333, icon: 'vector' }],
                  });
                }

                return Promise.resolve({
                  pm2: [],
                  services: [{ name: 'Nginx', port: 80, icon: 'nginx' }],
                });
              }),
          } satisfies Partial<IDockerClient>,
        },
        {
          provide: TOPOLOGY_LAYOUT_REPOSITORY,
          useValue: layoutRepository,
        },
      ],
    }).compile();

    service = module.get(DockerTopologyService);
    listContainers = module.get(ListContainersUseCase);
    dockerClient = module.get(DOCKER_CLIENT);
  });

  it('모든 컨테이너 제목에 실제 이름을 쓰고 친근한 이름과 비컨테이너 제목을 보존한다', async () => {
    const snapshot = await service.getSnapshot('user-1');
    for (const [id, name, alias] of [
      ['infra-nginx', 'kscold-nginx', 'Nginx Proxy'],
      ['infra-db', 'kscold-infra-db', 'PostgreSQL'],
      ['blog-app', 'ubuntu-blog', 'Blog'],
      ['blog-agent', 'kscold-vault-agent', 'Vault Agent'],
      ['blog-qdrant', 'kscold-vault-qdrant', 'Vault Qdrant'],
      ['projectdelta-app', 'ubuntu-projectdelta', 'ProjectDelta'],
    ]) {
      expect(
        snapshot.nodes.find((node) => node.id === `container-${id}`)?.data,
      ).toMatchObject({
        label: name,
        meta: { label: alias },
      });
    }
    for (const [id, label] of [
      ['internet', 'Internet'],
      ['host', 'Mac Mini (Host)'],
      ['local-control', 'kscold-control'],
    ]) {
      expect(snapshot.nodes.find((node) => node.id === id)?.data).toMatchObject(
        { label },
      );
    }
  });

  it('통합 이미지 프로세스와 서비스 포트를 전달하고 사라진 companion 노드는 만들지 않는다', async () => {
    const containers = await listContainers.execute(undefined);
    listContainers.execute.mockResolvedValue(
      containers.filter(
        (container) => !['blog-agent', 'blog-qdrant'].includes(container.id),
      ),
    );
    const supervisor = ['api', 'web', 'agent', 'mongod', 'qdrant'].map(
      (name, index) => ({
        name,
        status: 'running',
        pid: 10 + index,
        uptimeSeconds: 60,
      }),
    );
    const services = [
      { name: 'API', port: 8080, icon: 'api' },
      { name: 'Web', port: 3000, icon: 'web' },
      { name: 'Vault Agent', port: 9090, icon: 'agent' },
      { name: 'MongoDB', port: 27017, icon: 'mongo' },
      { name: 'Qdrant', port: 6333, icon: 'vector' },
    ];
    dockerClient.getContainerProcesses.mockImplementation(async (id) =>
      id === 'dock-blog'
        ? { pm2: [], supervisor, services }
        : { pm2: [], supervisor: [], services: [] },
    );
    const snapshot = await service.getSnapshot('user-1');

    expect(
      snapshot.nodes.find((node) => node.id === 'container-blog-app')?.data,
    ).toMatchObject({
      label: 'ubuntu-blog',
      processes: { supervisor, services },
    });
    expect(snapshot.summary.containerCount).toBe(4);
    expect(
      snapshot.nodes.filter((node) =>
        node.id.startsWith('container-blog-app-service-'),
      ),
    ).toHaveLength(5);
    expect(
      snapshot.nodes.some((node) =>
        ['container-blog-agent', 'container-blog-qdrant'].includes(node.id),
      ),
    ).toBe(false);
    const ids = new Set(snapshot.nodes.map((node) => node.id));
    expect(
      snapshot.edges.every(
        (edge) => ids.has(edge.source) && ids.has(edge.target),
      ),
    ).toBe(true);
  });

  it('PM2와 Supervisor가 모두 없어도 컨테이너 이름과 빈 프로세스 목록을 제공한다', async () => {
    dockerClient.getContainerProcesses.mockResolvedValue({
      pm2: [],
      supervisor: [],
      services: [],
    });
    const snapshot = await service.getSnapshot('user-1');
    expect(
      snapshot.nodes.find((node) => node.id === 'container-blog-app')?.data,
    ).toMatchObject({
      label: 'ubuntu-blog',
      processes: { pm2: [], supervisor: [], services: [] },
    });
  });

  it('구성과 실행 상태를 합쳐 토폴로지 스냅샷을 만든다', async () => {
    const snapshot = await service.getSnapshot('user-1');
    const blogNode = snapshot.nodes.find(
      (node) => node.id === 'container-blog-app',
    );
    const blogSiteNode = snapshot.nodes.find(
      (node) => node.id === 'nginx-blog',
    );
    const blogAgentNode = snapshot.nodes.find(
      (node) => node.id === 'container-blog-agent',
    );
    const blogQdrantNode = snapshot.nodes.find(
      (node) => node.id === 'container-blog-qdrant',
    );
    const controlNode = snapshot.nodes.find(
      (node) => node.id === 'local-control',
    );
    const projectdeltaNode = snapshot.nodes.find(
      (node) => node.id === 'container-projectdelta-app',
    );
    const projectdeltaSiteNode = snapshot.nodes.find(
      (node) => node.id === 'nginx-projectdelta',
    );
    const hostNode = snapshot.nodes.find((node) => node.id === 'host');
    const infraDbNode = snapshot.nodes.find(
      (node) => node.id === 'container-infra-db',
    );

    expect(snapshot.summary.containerCount).toBe(6);
    expect(snapshot.nodes.some((node) => node.id === 'host')).toBe(true);
    expect(snapshot.nodes.some((node) => node.id === 'local-control')).toBe(
      true,
    );
    expect(snapshot.nodes.some((node) => node.id === 'nginx-blog')).toBe(true);
    expect(
      snapshot.nodes.some((node) => node.id === 'nginx-projectdelta'),
    ).toBe(true);
    expect(
      snapshot.nodes.some(
        (node) => node.id === 'container-blog-app-service-SSH-22',
      ),
    ).toBe(true);
    expect(
      snapshot.edges.some(
        (edge) =>
          edge.source === 'nginx-blog' && edge.target === 'container-blog-app',
      ),
    ).toBe(true);
    expect(
      snapshot.edges.some(
        (edge) =>
          edge.source === 'nginx-control' && edge.target === 'local-control',
      ),
    ).toBe(true);
    expect(blogNode?.data).toEqual(
      expect.objectContaining({
        domains: expect.arrayContaining(['blog.example.com', 'example.com']),
        gateway: expect.objectContaining({
          mode: 'host-nginx',
          label: '공용 kscold-nginx 프록시',
        }),
      }),
    );
    expect(controlNode?.data).toEqual(
      expect.objectContaining({
        domains: expect.arrayContaining(['control.example.com']),
        gateway: expect.objectContaining({
          mode: 'host-nginx',
        }),
      }),
    );
    expect(projectdeltaNode?.data).toEqual(
      expect.objectContaining({
        domains: expect.arrayContaining(['projectdelta.example.com']),
        gateway: expect.objectContaining({
          mode: 'host-nginx',
        }),
      }),
    );
    expect(blogNode?.position.x).toBe(blogSiteNode?.position.x);
    expect(blogAgentNode?.position.x).toBeGreaterThan(
      blogNode?.position.x ?? 0,
    );
    expect(blogAgentNode?.position.x).toBeLessThan(
      (blogNode?.position.x ?? 0) + 350,
    );
    expect(blogAgentNode?.position.y).toBeGreaterThan(
      blogNode?.position.y ?? 0,
    );
    expect(blogQdrantNode?.position.x).toBeGreaterThan(
      blogAgentNode?.position.x ?? 0,
    );
    expect(blogQdrantNode?.position.x).toBeLessThan(
      (blogNode?.position.x ?? 0) + 650,
    );
    expect(
      snapshot.edges.some(
        (edge) =>
          edge.source === 'container-blog-app' &&
          edge.target === 'container-blog-agent',
      ),
    ).toBe(true);
    expect(
      snapshot.edges.some(
        (edge) =>
          edge.source === 'container-blog-app' &&
          edge.target === 'container-blog-qdrant',
      ),
    ).toBe(true);
    expect(projectdeltaNode?.position.x).toBe(projectdeltaSiteNode?.position.x);
    expect(
      (projectdeltaNode?.position.x ?? 0) - (blogNode?.position.x ?? 0),
    ).toBeGreaterThan(350);
    expect(controlNode?.position.x).toBeLessThan(infraDbNode?.position.x ?? 0);
    expect(
      (blogSiteNode?.position.y ?? 0) - (hostNode?.position.y ?? 0),
    ).toBeGreaterThan(500);
  });

  it('현재 사용자의 저장된 좌표를 스냅샷에 반영한다', async () => {
    layoutRepository.findPositionsByUser.mockResolvedValue([
      { nodeId: 'container-blog-app', x: 123, y: 456 },
    ]);

    const snapshot = await service.getSnapshot('user-1');
    const blogNode = snapshot.nodes.find(
      (node) => node.id === 'container-blog-app',
    );

    expect(blogNode?.position).toEqual({ x: 123, y: 456 });
    expect(layoutRepository.findPositionsByUser).toHaveBeenCalledWith('user-1');
  });

  it('유효한 노드 좌표만 저장소 포트로 upsert한다', async () => {
    await service.saveNodePositions('user-1', [
      { nodeId: 'host', x: 10, y: 20 },
      { nodeId: 'invalid', x: Number.NaN, y: 30 },
    ]);

    expect(layoutRepository.upsertPositions).toHaveBeenCalledWith('user-1', [
      { nodeId: 'host', x: 10, y: 20 },
    ]);
  });
});
