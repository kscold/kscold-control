import { Test, TestingModule } from '@nestjs/testing';
import { ListContainersUseCase } from '@/docker/application/use-cases/list-containers.use-case';
import {
  IContainerRepository,
  CONTAINER_REPOSITORY,
} from '@/docker/domain/repositories/container.repository.interface';
import {
  IDockerClient,
  DOCKER_CLIENT,
} from '@/docker/domain/gateways/docker-client.gateway.interface';
import { PortForwardingService } from '@/docker/application/services/port-forwarding.service';
import { ComposeService } from '@/docker/application/services/compose.service';
import { Container } from '@/docker/domain/entities/container.entity';

describe('ListContainersUseCase', () => {
  let useCase: ListContainersUseCase;
  let containerRepo: jest.Mocked<IContainerRepository>;
  let dockerClient: jest.Mocked<IDockerClient>;
  let portForwardingService: jest.Mocked<PortForwardingService>;
  let composeService: jest.Mocked<ComposeService>;

  beforeEach(async () => {
    const mockContainerRepo: Partial<IContainerRepository> = {
      findAll: jest.fn(),
      findByUserId: jest.fn(),
      save: jest.fn(),
    };

    const mockDockerClient: Partial<IDockerClient> = {
      listContainers: jest.fn(),
      inspectContainer: jest.fn(),
    };

    const mockPortForwardingService: Partial<PortForwardingService> = {
      getExternalAccess: jest.fn(),
    };

    const mockComposeService: Partial<ComposeService> = {
      listServices: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListContainersUseCase,
        {
          provide: CONTAINER_REPOSITORY,
          useValue: mockContainerRepo,
        },
        {
          provide: DOCKER_CLIENT,
          useValue: mockDockerClient,
        },
        {
          provide: PortForwardingService,
          useValue: mockPortForwardingService,
        },
        {
          provide: ComposeService,
          useValue: mockComposeService,
        },
      ],
    }).compile();

    useCase = module.get<ListContainersUseCase>(ListContainersUseCase);
    containerRepo = module.get(CONTAINER_REPOSITORY);
    dockerClient = module.get(DOCKER_CLIENT);
    portForwardingService = module.get(PortForwardingService);
    composeService = module.get(ComposeService);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  describe('execute', () => {
    const mockDbContainers = [
      {
        id: 'container-1',
        dockerId: 'docker-abc123',
        name: 'test-container-1',
        image: 'ubuntu:22.04',
        status: 'running',
        ports: { '8080': 3000 },
        resources: { cpus: 2, memory: '4g' },
        environment: {},
        userId: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'container-2',
        dockerId: 'docker-xyz789',
        name: 'test-container-2',
        image: 'nginx:latest',
        status: 'stopped',
        ports: { '80': 8080 },
        resources: { cpus: 1, memory: '2g' },
        environment: {},
        userId: 'user-456',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as unknown as Container[];

    const mockDockerContainers = [
      {
        id: 'docker-abc123456',
        name: 'test-container-1',
        state: 'running',
        image: 'ubuntu:22.04',
        created: 1_700_000_000,
        ports: [{ privatePort: 8080, publicPort: 3000, type: 'tcp' }],
      },
      {
        id: 'docker-xyz789012',
        name: 'test-container-2',
        state: 'stopped',
        image: 'nginx:latest',
        created: 1_700_000_100,
        ports: [{ privatePort: 80, publicPort: 8080, type: 'tcp' }],
      },
    ];

    const mockInspectData = {
      HostConfig: {
        NanoCpus: 2000000000, // 2 CPUs
        Memory: 4294967296, // 4GB
      },
    };

    beforeEach(() => {
      /*
       * 포트 변경 테스트는 관리 엔티티의 ports 필드를 갱신함. 원본 배열을 그대로
       * 재사용하면 다음 테스트가 변경된 값을 받아 실행 순서에 따라 결과가 달라짐.
       * 매번 중첩 객체까지 복제해 각 테스트가 독립적인 DB 조회 결과를 받게 함.
       */
      const dbContainers = mockDbContainers.map((container) => ({
        ...container,
        ports: { ...container.ports },
        resources: { ...container.resources },
        environment: { ...container.environment },
      }));

      dockerClient.listContainers.mockResolvedValue(
        mockDockerContainers as any,
      );
      containerRepo.findAll.mockResolvedValue(dbContainers);
      containerRepo.findByUserId.mockResolvedValue([dbContainers[0]]);
      dockerClient.inspectContainer.mockResolvedValue(mockInspectData as any);
      portForwardingService.getExternalAccess.mockReturnValue({
        domain: 'localhost',
        http: 'http://localhost:3000',
      });
      composeService.listServices.mockReturnValue(['test-container-1']);
    });

    it('should list all containers when no userId provided', async () => {
      const result = await useCase.execute();

      expect(dockerClient.listContainers).toHaveBeenCalledWith(true);
      expect(containerRepo.findAll).toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });

    it('should filter containers by userId when provided', async () => {
      const result = await useCase.execute('user-123');

      expect(containerRepo.findByUserId).toHaveBeenCalledWith('user-123');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('test-container-1');
    });

    it('should match Docker containers with DB containers', async () => {
      const result = await useCase.execute();

      expect(result[0].name).toBe('test-container-1');
      expect(result[0].status).toBe('running');
      expect(result[1].name).toBe('test-container-2');
      expect(result[1].status).toBe('stopped');
      expect(result[0].isComposeManaged).toBe(true);
      expect(result[1].isComposeManaged).toBe(false);
    });

    it('should skip containers not in DB', async () => {
      const extraDockerContainer = {
        id: 'docker-unknown',
        name: 'unknown-container',
        state: 'running',
        image: 'redis:latest',
        created: 1_700_000_200,
        ports: [],
      };

      dockerClient.listContainers.mockResolvedValue([
        ...mockDockerContainers,
        extraDockerContainer,
      ] as any);

      const result = await useCase.execute();

      expect(result).toHaveLength(3);
      expect(result[2].isManaged).toBe(false);
      expect(result[2].name).toBe('unknown-container');
      expect(result[2].isComposeManaged).toBe(false);
    });

    it('should parse ports correctly', async () => {
      const result = await useCase.execute();

      expect(result[0].ports).toEqual({ '8080': 3000 });
      expect(result[1].ports).toEqual({ '80': 8080 });
    });

    it('should inspect container for resource info', async () => {
      await useCase.execute();

      expect(dockerClient.inspectContainer).toHaveBeenCalledWith(
        'docker-abc123456',
      );
      expect(dockerClient.inspectContainer).toHaveBeenCalledWith(
        'docker-xyz789012',
      );
    });

    it('should use DB resources if inspection fails', async () => {
      dockerClient.inspectContainer.mockRejectedValue(
        new Error('Inspection failed'),
      );

      const result = await useCase.execute();

      expect(result[0].resources).toEqual({ cpus: 2, memory: '4g' });
    });

    it('should get external access info for each container', async () => {
      await useCase.execute();

      expect(portForwardingService.getExternalAccess).toHaveBeenCalledTimes(2);
    });

    it('should update container if ports changed', async () => {
      const differentPorts = [
        { privatePort: 8080, publicPort: 4000, type: 'tcp' },
      ];

      dockerClient.listContainers.mockResolvedValue([
        {
          ...mockDockerContainers[0],
          ports: differentPorts,
        },
      ] as any);

      await useCase.execute();

      expect(containerRepo.save).toHaveBeenCalled();
    });

    it('포트가 변경되지 않으면 관리 정보를 저장하지 않는다', async () => {
      await useCase.execute();

      expect(containerRepo.save).not.toHaveBeenCalled();
    });

    it('should handle Docker client errors', async () => {
      dockerClient.listContainers.mockRejectedValue(
        new Error('Docker daemon not running'),
      );

      await expect(useCase.execute()).rejects.toThrow(
        'Docker daemon not running',
      );
    });

    it('should return empty array if no containers found', async () => {
      dockerClient.listContainers.mockResolvedValue([]);
      containerRepo.findAll.mockResolvedValue([]);

      const result = await useCase.execute();

      expect(result).toEqual([]);
    });
  });
});
