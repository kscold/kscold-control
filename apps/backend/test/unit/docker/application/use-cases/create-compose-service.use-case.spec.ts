import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CreateComposeServiceUseCase } from '@/docker/application/use-cases/create-compose-service.use-case';
import {
  CONTAINER_REPOSITORY,
  IContainerRepository,
} from '@/docker/domain/repositories/container.repository.interface';
import {
  DOCKER_CLIENT,
  IDockerClient,
} from '@/docker/domain/gateways/docker-client.gateway.interface';
import { ComposeService } from '@/docker/application/services/compose.service';
import { ImportContainerUseCase } from '@/docker/application/use-cases/import-container.use-case';
import { PortForwardingService } from '@/docker/application/services/port-forwarding.service';

describe('CreateComposeServiceUseCase', () => {
  let useCase: CreateComposeServiceUseCase;
  let containerRepo: jest.Mocked<IContainerRepository>;
  let dockerClient: jest.Mocked<IDockerClient>;
  let composeService: jest.Mocked<ComposeService>;
  let importContainerUseCase: jest.Mocked<ImportContainerUseCase>;
  let portForwardingService: jest.Mocked<PortForwardingService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateComposeServiceUseCase,
        {
          provide: CONTAINER_REPOSITORY,
          useValue: {
            findByName: jest.fn(),
          },
        },
        {
          provide: DOCKER_CLIENT,
          useValue: {
            listContainers: jest.fn(),
          },
        },
        {
          provide: ComposeService,
          useValue: {
            hasService: jest.fn(),
            ensurePortsAvailable: jest.fn(),
            addService: jest.fn(),
            upService: jest.fn(),
            rollbackServiceCreation: jest.fn(),
          },
        },
        {
          provide: ImportContainerUseCase,
          useValue: {
            execute: jest.fn(),
          },
        },
        {
          provide: PortForwardingService,
          useValue: {
            addPortForwardingRules: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    useCase = module.get(CreateComposeServiceUseCase);
    containerRepo = module.get(CONTAINER_REPOSITORY);
    dockerClient = module.get(DOCKER_CLIENT);
    composeService = module.get(ComposeService);
    importContainerUseCase = module.get(ImportContainerUseCase);
    portForwardingService = module.get(PortForwardingService);
  });

  it('compose 서비스 생성 후 컨테이너를 관리 대상으로 가져온다', async () => {
    containerRepo.findByName.mockResolvedValue(null);
    composeService.hasService.mockReturnValue(false);
    composeService.ensurePortsAvailable.mockResolvedValue(undefined);
    composeService.upService.mockResolvedValue('created');
    dockerClient.listContainers
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'docker-1',
          name: 'ubuntu-e2e',
          image: 'ubuntu:22.04',
          state: 'running',
          status: 'Up 3 seconds',
          ports: [],
          created: 1_000,
        },
      ]);
    importContainerUseCase.execute.mockResolvedValue({
      id: 'container-1',
    } as any);

    const result = await useCase.execute(
      {
        name: 'ubuntu-e2e',
        image: 'ubuntu:22.04',
        ports: { '22': 2227, '8080': 8085 },
        cpus: '2',
        memLimit: '4g',
      },
      'user-1',
    );

    expect(composeService.addService).toHaveBeenCalled();
    expect(composeService.upService).toHaveBeenCalledWith('ubuntu-e2e');
    expect(importContainerUseCase.execute).toHaveBeenCalledWith(
      'docker-1',
      'user-1',
    );
    expect(portForwardingService.addPortForwardingRules).toHaveBeenCalledWith(
      'ubuntu-e2e',
      { '22': 2227, '8080': 8085 },
    );
    expect(result.output).toBe('created');
  });

  it('이미 존재하는 이름이면 생성하지 않는다', async () => {
    containerRepo.findByName.mockResolvedValue({ id: '1' } as any);

    await expect(
      useCase.execute(
        {
          name: 'ubuntu-e2e',
          image: 'ubuntu:22.04',
          ports: { '22': 2227, '8080': 8085 },
          cpus: '2',
          memLimit: '4g',
        },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('중간 실패 시 compose 정의를 원복한다', async () => {
    containerRepo.findByName.mockResolvedValue(null);
    composeService.hasService.mockReturnValue(false);
    composeService.ensurePortsAvailable.mockResolvedValue(undefined);
    composeService.upService.mockRejectedValue(new Error('compose failed'));

    await expect(
      useCase.execute(
        {
          name: 'ubuntu-e2e',
          image: 'ubuntu:22.04',
          ports: { '22': 2227, '8080': 8085 },
          cpus: '2',
          memLimit: '4g',
        },
        'user-1',
      ),
    ).rejects.toThrow('compose failed');

    expect(composeService.rollbackServiceCreation).toHaveBeenCalledWith(
      'ubuntu-e2e',
    );
  });
});
