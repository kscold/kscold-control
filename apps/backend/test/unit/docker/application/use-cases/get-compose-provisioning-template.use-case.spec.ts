import { Test, TestingModule } from '@nestjs/testing';
import { GetComposeProvisioningTemplateUseCase } from '@/docker/application/use-cases/get-compose-provisioning-template.use-case';
import { ComposeService } from '@/docker/application/services/compose.service';

describe('GetComposeProvisioningTemplateUseCase', () => {
  let useCase: GetComposeProvisioningTemplateUseCase;
  let composeService: jest.Mocked<ComposeService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetComposeProvisioningTemplateUseCase,
        {
          provide: ComposeService,
          useValue: {
            getUsedHostPorts: jest.fn(),
            listServices: jest.fn(),
          },
        },
      ],
    }).compile();

    useCase = module.get(GetComposeProvisioningTemplateUseCase);
    composeService = module.get(ComposeService);
  });

  it('사용 중인 포트를 피해서 생성 기본값을 계산한다', async () => {
    composeService.getUsedHostPorts.mockResolvedValue(
      new Set([2227, 2228, 8085]),
    );
    composeService.listServices.mockReturnValue(['ubuntu-260405123000']);

    const result = await useCase.execute();

    expect(result.image).toBe('ubuntu:22.04');
    expect(result.ports['22']).toBe(2229);
    expect(result.ports['8080']).toBe(8086);
    expect(result.name).toMatch(/^ubuntu-/);
  });
});
