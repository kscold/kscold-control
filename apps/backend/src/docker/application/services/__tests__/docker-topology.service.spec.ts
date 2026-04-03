import { Test, TestingModule } from '@nestjs/testing';
import { DockerTopologyService } from '../docker-topology.service';
import { ComposeService } from '../compose.service';
import { ListContainersUseCase } from '../../use-cases';
import {
  NGINX_CONFIG_REPOSITORY,
  type INginxConfigRepository,
} from '../../../../nginx/domain/interfaces/nginx-config.repository';
import {
  DOCKER_CLIENT,
  type IDockerClient,
} from '../../../domain/repositories/docker-client.interface';

describe('DockerTopologyService', () => {
  let service: DockerTopologyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DockerTopologyService,
        {
          provide: ComposeService,
          useValue: {
            listServices: jest.fn().mockReturnValue([
              'nginx',
              'kscold-infra-db',
              'ubuntu-blog',
            ]),
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
                image: 'kscold/ubuntu-blog:latest',
                status: 'running',
                liveStatus: 'running',
                ports: { '3000': 3000, '22': 2224 },
                resources: { cpus: 2, memory: '2g' },
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
                domain: 'blog.kscold.com',
                upstream: 'http://ubuntu-blog:3000',
                ssl: true,
                sslCert: '',
                sslKey: '',
                websocket: true,
                enabled: true,
              },
              {
                name: 'control',
                domain: 'control.kscold.com',
                upstream: 'http://host.docker.internal:4000',
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
            getContainerProcesses: jest.fn().mockImplementation((dockerId: string) => {
              if (dockerId === 'dock-db') {
                return Promise.resolve({
                  pm2: [],
                  services: [{ name: 'PostgreSQL', port: 5432, icon: 'pg' }],
                });
              }

              if (dockerId === 'dock-blog') {
                return Promise.resolve({
                  pm2: [{ name: 'blog-api', status: 'online', cpu: 0, memory: 0, restarts: 0 }],
                  services: [{ name: 'SSH', port: 22, icon: 'ssh' }],
                });
              }

              return Promise.resolve({ pm2: [], services: [{ name: 'Nginx', port: 80, icon: 'nginx' }] });
            }),
          } satisfies Partial<IDockerClient>,
        },
      ],
    }).compile();

    service = module.get(DockerTopologyService);
  });

  it('구성과 실행 상태를 합쳐 토폴로지 스냅샷을 만든다', async () => {
    const snapshot = await service.getSnapshot();

    expect(snapshot.summary.containerCount).toBe(3);
    expect(snapshot.nodes.some((node) => node.id === 'host')).toBe(true);
    expect(snapshot.nodes.some((node) => node.id === 'local-control')).toBe(true);
    expect(snapshot.nodes.some((node) => node.id === 'nginx-blog')).toBe(true);
    expect(
      snapshot.nodes.some((node) =>
        node.id === 'container-blog-app-service-SSH-22',
      ),
    ).toBe(true);
    expect(
      snapshot.edges.some(
        (edge) => edge.source === 'nginx-blog' && edge.target === 'container-blog-app',
      ),
    ).toBe(true);
    expect(
      snapshot.edges.some(
        (edge) => edge.source === 'nginx-control' && edge.target === 'local-control',
      ),
    ).toBe(true);
  });
});
