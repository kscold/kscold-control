import type { Mocked } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { RemoveComposeServiceUseCase } from '@/docker/application/use-cases/remove-compose-service.use-case';
import {
  CONTAINER_REPOSITORY,
  IContainerRepository,
} from '@/docker/domain/repositories/container.repository.interface';
import { ComposeService } from '@/docker/application/services/compose.service';
import { PortForwardingService } from '@/docker/application/services/port-forwarding.service';

describe('RemoveComposeServiceUseCase', () => {
  let useCase: RemoveComposeServiceUseCase;
  let containerRepo: Mocked<IContainerRepository>;
  let composeService: Mocked<ComposeService>;
  let portForwardingService: Mocked<PortForwardingService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RemoveComposeServiceUseCase,
        {
          provide: CONTAINER_REPOSITORY,
          useValue: {
            findByName: vi.fn(),
            delete: vi.fn(),
          },
        },
        {
          provide: ComposeService,
          useValue: {
            hasService: vi.fn(),
            downService: vi.fn(),
            removeService: vi.fn(),
          },
        },
        {
          provide: PortForwardingService,
          useValue: {
            removePortForwardingRules: vi.fn(),
          },
        },
      ],
    }).compile();

    useCase = module.get(RemoveComposeServiceUseCase);
    containerRepo = module.get(CONTAINER_REPOSITORY);
    composeService = module.get(ComposeService);
    portForwardingService = module.get(PortForwardingService);
  });

  it('compose 서비스와 관리 정보를 함께 제거한다', async () => {
    composeService.hasService.mockReturnValue(true);
    composeService.downService.mockResolvedValue('removed');
    containerRepo.findByName.mockResolvedValue({ id: 'db-1' } as any);

    const result = await useCase.execute('ubuntu-e2e');

    expect(composeService.downService).toHaveBeenCalledWith('ubuntu-e2e');
    expect(composeService.removeService).toHaveBeenCalledWith('ubuntu-e2e');
    expect(
      portForwardingService.removePortForwardingRules,
    ).toHaveBeenCalledWith('ubuntu-e2e');
    expect(containerRepo.delete).toHaveBeenCalledWith('db-1');
    expect(result.output).toBe('removed');
  });

  it('compose에 없는 서비스면 제거하지 않는다', async () => {
    composeService.hasService.mockReturnValue(false);

    await expect(useCase.execute('missing')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
