import { Test, TestingModule } from '@nestjs/testing';
import { CreateContainerUseCase } from '../create-container.use-case';
import {
  IContainerRepository,
  CONTAINER_REPOSITORY,
} from '../../../domain/repositories/container.repository.interface';
import {
  IDockerClient,
  DOCKER_CLIENT,
} from '../../../domain/repositories/docker-client.interface';
import { PortForwardingService } from '../../services/port-forwarding.service';
import { CreateContainerDto } from '../../dto/create-container.dto';
import { Container } from '../../../domain/entities/container.entity';

describe('CreateContainerUseCase', () => {
  let useCase: CreateContainerUseCase;
  let containerRepo: jest.Mocked<IContainerRepository>;
  let dockerClient: jest.Mocked<IDockerClient>;
  let portForwardingService: jest.Mocked<PortForwardingService>;

  beforeEach(async () => {
    // Mock dependencies
    const mockContainerRepo: Partial<IContainerRepository> = {
      create: jest.fn(),
      save: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      delete: jest.fn(),
    };

    const mockDockerClient: Partial<IDockerClient> = {
      pullImage: jest.fn(),
      createContainer: jest.fn(),
      startContainer: jest.fn(),
      stopContainer: jest.fn(),
      removeContainer: jest.fn(),
      listContainers: jest.fn(),
      inspectContainer: jest.fn(),
    };

    const mockPortForwardingService: Partial<PortForwardingService> = {
      addPortForwardingRules: jest.fn(),
      getExternalAccess: jest.fn(),
      removePortForwardingRules: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateContainerUseCase,
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
      ],
    }).compile();

    useCase = module.get<CreateContainerUseCase>(CreateContainerUseCase);
    containerRepo = module.get(CONTAINER_REPOSITORY);
    dockerClient = module.get(DOCKER_CLIENT);
    portForwardingService = module.get(PortForwardingService);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  describe('execute', () => {
    const mockDto: CreateContainerDto = {
      name: 'test-container',
      image: 'ubuntu:22.04',
      ports: {
        '8080': 3000,
        '22': 2222,
      },
      resources: {
        cpus: 2,
        memory: '4g',
      },
      environment: { NODE_ENV: 'production' },
      userId: 'user-123',
    };

    const mockContainer: Container = {
      id: 'container-123',
      dockerId: 'docker-abc123',
      name: 'test-container',
      image: 'ubuntu:22.04',
      status: 'created',
      ports: mockDto.ports,
      resources: {
        cpus: 2,
        memory: '4g',
      },
      environment: mockDto.environment,
      userId: 'user-123',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Container;

    beforeEach(() => {
      // Setup default mocks
      dockerClient.pullImage.mockResolvedValue(undefined);
      dockerClient.createContainer.mockResolvedValue('docker-abc123');
      containerRepo.create.mockReturnValue(mockContainer);
      containerRepo.save.mockResolvedValue(mockContainer);
      portForwardingService.addPortForwardingRules.mockResolvedValue(undefined);
      portForwardingService.getExternalAccess.mockReturnValue({
        domain: 'localhost',
        http: 'http://localhost:3000',
        ssh: 'ssh://localhost:2222',
      });
    });

    it('should create a container successfully', async () => {
      const result = await useCase.execute(mockDto);

      expect(result).toBeDefined();
      expect(result.name).toBe('test-container');
      expect(result.status).toBe('created');
    });

    it('should pull image before creating container', async () => {
      await useCase.execute(mockDto);

      expect(dockerClient.pullImage).toHaveBeenCalledWith('ubuntu:22.04');
      expect(dockerClient.createContainer).toHaveBeenCalled();
    });

    it('should validate resources using ResourceConfig', async () => {
      await useCase.execute(mockDto);

      expect(dockerClient.createContainer).toHaveBeenCalledWith(
        expect.objectContaining({
          resources: {
            cpus: 2,
            memory: '4g',
          },
        }),
      );
    });

    it('should save container to repository', async () => {
      await useCase.execute(mockDto);

      expect(containerRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          dockerId: 'docker-abc123',
          name: 'test-container',
          image: 'ubuntu:22.04',
          status: 'created',
        }),
      );
      expect(containerRepo.save).toHaveBeenCalledWith(mockContainer);
    });

    it('should setup port forwarding asynchronously', async () => {
      await useCase.execute(mockDto);

      expect(portForwardingService.addPortForwardingRules).toHaveBeenCalledWith(
        'test-container',
        mockDto.ports,
      );
    });

    it('should include external access info in response', async () => {
      const result = await useCase.execute(mockDto);

      expect(portForwardingService.getExternalAccess).toHaveBeenCalledWith(
        mockDto.ports,
      );
      expect(result.externalAccess).toBeDefined();
    });

    it('should throw error if resource validation fails', async () => {
      const invalidDto = {
        ...mockDto,
        resources: { cpus: -1, memory: 'invalid' },
      };

      await expect(useCase.execute(invalidDto)).rejects.toThrow();
    });

    it('should handle docker client errors', async () => {
      dockerClient.createContainer.mockRejectedValue(
        new Error('Docker daemon not running'),
      );

      await expect(useCase.execute(mockDto)).rejects.toThrow(
        'Docker daemon not running',
      );
    });

    it('should not fail if port forwarding setup fails', async () => {
      portForwardingService.addPortForwardingRules.mockRejectedValue(
        new Error('Port forwarding failed'),
      );

      // Should still succeed because port forwarding is async
      const result = await useCase.execute(mockDto);
      expect(result).toBeDefined();
    });

    it('should handle repository save errors', async () => {
      containerRepo.save.mockRejectedValue(new Error('Database error'));

      await expect(useCase.execute(mockDto)).rejects.toThrow('Database error');
    });
  });
});
