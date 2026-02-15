import { Test, TestingModule } from '@nestjs/testing';
import { StartContainerUseCase } from '../start-container.use-case';
import {
  IContainerRepository,
  CONTAINER_REPOSITORY,
} from '../../../domain/repositories/container.repository.interface';
import {
  IDockerClient,
  DOCKER_CLIENT,
} from '../../../domain/repositories/docker-client.interface';
import { ContainerNotFoundException } from '../../../../common/exceptions';
import { Container } from '../../../domain/entities/container.entity';

describe('StartContainerUseCase', () => {
  let useCase: StartContainerUseCase;
  let containerRepo: jest.Mocked<IContainerRepository>;
  let dockerClient: jest.Mocked<IDockerClient>;

  beforeEach(async () => {
    const mockContainerRepo: Partial<IContainerRepository> = {
      findById: jest.fn(),
      updateStatus: jest.fn(),
    };

    const mockDockerClient: Partial<IDockerClient> = {
      startContainer: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StartContainerUseCase,
        {
          provide: CONTAINER_REPOSITORY,
          useValue: mockContainerRepo,
        },
        {
          provide: DOCKER_CLIENT,
          useValue: mockDockerClient,
        },
      ],
    }).compile();

    useCase = module.get<StartContainerUseCase>(StartContainerUseCase);
    containerRepo = module.get(CONTAINER_REPOSITORY);
    dockerClient = module.get(DOCKER_CLIENT);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  describe('execute', () => {
    const mockContainer: Container = {
      id: 'container-123',
      dockerId: 'docker-abc123',
      name: 'test-container',
      image: 'ubuntu:22.04',
      status: 'stopped',
      ports: {},
      resources: { cpus: 2, memory: '4g' },
      userId: 'user-123',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Container;

    beforeEach(() => {
      containerRepo.findById.mockResolvedValue(mockContainer);
      dockerClient.startContainer.mockResolvedValue(undefined);
      containerRepo.updateStatus.mockResolvedValue(undefined);
    });

    it('should start container successfully', async () => {
      await useCase.execute('container-123');

      expect(containerRepo.findById).toHaveBeenCalledWith('container-123');
      expect(dockerClient.startContainer).toHaveBeenCalledWith('docker-abc123');
      expect(containerRepo.updateStatus).toHaveBeenCalledWith(
        'container-123',
        'running',
      );
    });

    it('should throw ContainerNotFoundException if container not found', async () => {
      containerRepo.findById.mockResolvedValue(null);

      await expect(useCase.execute('invalid-id')).rejects.toThrow(
        ContainerNotFoundException,
      );
    });

    it('should update status after starting container', async () => {
      await useCase.execute('container-123');

      expect(dockerClient.startContainer).toHaveBeenCalled();
      expect(containerRepo.updateStatus).toHaveBeenCalled();
    });

    it('should propagate Docker errors', async () => {
      dockerClient.startContainer.mockRejectedValue(
        new Error('Container already running'),
      );

      await expect(useCase.execute('container-123')).rejects.toThrow(
        'Container already running',
      );
    });
  });
});
