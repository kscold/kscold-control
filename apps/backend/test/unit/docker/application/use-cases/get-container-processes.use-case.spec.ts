import { Test, TestingModule } from '@nestjs/testing';
import { ContainerNotFoundException } from '@/common/exceptions';
import {
  CONTAINER_REPOSITORY,
  type IContainerRepository,
} from '@/docker/domain/repositories/container.repository.interface';
import {
  DOCKER_CLIENT,
  type IDockerClient,
} from '@/docker/domain/gateways/docker-client.gateway.interface';
import { GetContainerProcessesUseCase } from '@/docker/application/use-cases/get-container-processes.use-case';

describe('GetContainerProcessesUseCase', () => {
  let useCase: GetContainerProcessesUseCase;
  let containerRepository: jest.Mocked<IContainerRepository>;
  let dockerClient: jest.Mocked<IDockerClient>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetContainerProcessesUseCase,
        {
          provide: CONTAINER_REPOSITORY,
          useValue: {
            findByDockerId: jest.fn(),
          } satisfies Partial<IContainerRepository>,
        },
        {
          provide: DOCKER_CLIENT,
          useValue: {
            getContainerProcesses: jest.fn(),
          } satisfies Partial<IDockerClient>,
        },
      ],
    }).compile();

    useCase = module.get(GetContainerProcessesUseCase);
    containerRepository = module.get(CONTAINER_REPOSITORY);
    dockerClient = module.get(DOCKER_CLIENT);
  });

  it('일반 사용자는 자신의 관리 컨테이너 프로세스만 조회한다', async () => {
    const processes = {
      pm2: [{ name: 'api' }],
      services: [{ name: 'api', port: 4000, icon: 'api' }],
    };
    containerRepository.findByDockerId.mockResolvedValue({
      dockerId: 'docker-1',
      userId: 'user-1',
    } as any);
    dockerClient.getContainerProcesses.mockResolvedValue(processes);

    await expect(useCase.execute('docker-1', 'user-1')).resolves.toEqual(
      processes,
    );
    expect(containerRepository.findByDockerId).toHaveBeenCalledWith('docker-1');
    expect(dockerClient.getContainerProcesses).toHaveBeenCalledWith('docker-1');
  });

  it('다른 사용자의 컨테이너는 존재 여부와 관계없이 찾을 수 없다고 처리한다', async () => {
    containerRepository.findByDockerId.mockResolvedValue({
      dockerId: 'docker-1',
      userId: 'other-user',
    } as any);

    await expect(useCase.execute('docker-1', 'user-1')).rejects.toThrow(
      ContainerNotFoundException,
    );
    expect(dockerClient.getContainerProcesses).not.toHaveBeenCalled();
  });

  it('전역 관리자는 관리되지 않은 Docker 컨테이너도 조회할 수 있다', async () => {
    const processes = { pm2: [], services: [] };
    dockerClient.getContainerProcesses.mockResolvedValue(processes);

    await expect(useCase.execute('external-docker-id')).resolves.toEqual(
      processes,
    );
    expect(containerRepository.findByDockerId).not.toHaveBeenCalled();
    expect(dockerClient.getContainerProcesses).toHaveBeenCalledWith(
      'external-docker-id',
    );
  });
});
