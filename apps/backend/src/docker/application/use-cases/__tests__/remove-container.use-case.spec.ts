import { Test, TestingModule } from '@nestjs/testing';
import { RemoveContainerUseCase } from '../remove-container.use-case';
import {
  IContainerRepository,
  CONTAINER_REPOSITORY,
} from '../../../domain/repositories/container.repository.interface';
import {
  IDockerClient,
  DOCKER_CLIENT,
} from '../../../domain/repositories/docker-client.interface';
import { PortForwardingService } from '../../services/port-forwarding.service';
import { ContainerNotFoundException } from '../../../../common/exceptions';
import { Container } from '../../../domain/entities/container.entity';

describe('RemoveContainerUseCase', () => {
  let useCase: RemoveContainerUseCase;
  let containerRepo: jest.Mocked<IContainerRepository>;
  let dockerClient: jest.Mocked<IDockerClient>;
  let portForwardingService: jest.Mocked<PortForwardingService>;

  beforeEach(async () => {
    const mockContainerRepo: Partial<IContainerRepository> = {
      findById: jest.fn(),
      delete: jest.fn(),
    };

    const mockDockerClient: Partial<IDockerClient> = {
      removeContainer: jest.fn(),
    };

    const mockPortForwardingService: Partial<PortForwardingService> = {
      removePortForwardingRules: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RemoveContainerUseCase,
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

    useCase = module.get<RemoveContainerUseCase>(RemoveContainerUseCase);
    containerRepo = module.get(CONTAINER_REPOSITORY);
    dockerClient = module.get(DOCKER_CLIENT);
    portForwardingService = module.get(PortForwardingService);
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
      dockerClient.removeContainer.mockResolvedValue(undefined);
      portForwardingService.removePortForwardingRules.mockResolvedValue(undefined);
      containerRepo.delete.mockResolvedValue(undefined);
    });

    it('should remove container successfully', async () => {
      await useCase.execute('container-123');

      expect(containerRepo.findById).toHaveBeenCalledWith('container-123');
      expect(dockerClient.removeContainer).toHaveBeenCalledWith('docker-abc123');
      expect(portForwardingService.removePortForwardingRules).toHaveBeenCalledWith(
        'test-container',
      );
      expect(containerRepo.delete).toHaveBeenCalledWith('container-123');
    });

    it('should throw ContainerNotFoundException if container not found', async () => {
      containerRepo.findById.mockResolvedValue(null);

      await expect(useCase.execute('invalid-id')).rejects.toThrow(
        ContainerNotFoundException,
      );
    });

    it('should continue with DB deletion if Docker removal fails', async () => {
      dockerClient.removeContainer.mockRejectedValue(
        new Error('Docker error'),
      );

      await useCase.execute('container-123');

      // Should still delete from DB
      expect(containerRepo.delete).toHaveBeenCalledWith('container-123');
    });

    it('should continue with DB deletion if port forwarding removal fails', async () => {
      portForwardingService.removePortForwardingRules.mockRejectedValue(
        new Error('Port forwarding error'),
      );

      await useCase.execute('container-123');

      // Should still delete from DB
      expect(containerRepo.delete).toHaveBeenCalledWith('container-123');
    });

    it('should delete from DB after Docker and port forwarding cleanup', async () => {
      await useCase.execute('container-123');

      expect(dockerClient.removeContainer).toHaveBeenCalled();
      expect(portForwardingService.removePortForwardingRules).toHaveBeenCalled();
      expect(containerRepo.delete).toHaveBeenCalled();
    });

    it('should propagate database errors', async () => {
      containerRepo.delete.mockRejectedValue(new Error('Database error'));

      await expect(useCase.execute('container-123')).rejects.toThrow(
        'Database error',
      );
    });
  });
});
