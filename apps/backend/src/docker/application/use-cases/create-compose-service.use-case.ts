import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import {
  IContainerRepository,
  CONTAINER_REPOSITORY,
} from '../../domain/repositories/container.repository.interface';
import {
  IDockerClient,
  DOCKER_CLIENT,
} from '../../domain/repositories/docker-client.interface';
import { ImportContainerUseCase } from './import-container.use-case';
import {
  ComposeService,
  ComposeServiceConfig,
} from '../services/compose.service';
import { ContainerResponseDto } from '../dto/container-response.dto';

/**
 * compose 기반 Ubuntu 인스턴스를 생성하고 관리 대상으로 등록합니다.
 */
@Injectable()
export class CreateComposeServiceUseCase {
  private readonly logger = new Logger(CreateComposeServiceUseCase.name);

  constructor(
    @Inject(CONTAINER_REPOSITORY)
    private readonly containerRepo: IContainerRepository,
    @Inject(DOCKER_CLIENT)
    private readonly dockerClient: IDockerClient,
    private readonly composeService: ComposeService,
    private readonly importContainerUseCase: ImportContainerUseCase,
  ) {}

  async execute(
    config: ComposeServiceConfig,
    userId: string,
  ): Promise<{ output: string; container: ContainerResponseDto }> {
    await this.validateBeforeCreate(config);

    let output = '';

    try {
      this.composeService.addService(config);
      output = await this.composeService.upService(config.name);

      const dockerContainer = await this.waitForContainer(config.name);
      const container = await this.importContainerUseCase.execute(
        dockerContainer.id,
        userId,
      );

      return { output, container };
    } catch (error) {
      await this.composeService.rollbackServiceCreation(config.name);
      this.logger.error(
        `Compose 서비스 생성 실패: ${config.name}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  private async validateBeforeCreate(
    config: ComposeServiceConfig,
  ): Promise<void> {
    const existingContainer = await this.containerRepo.findByName(config.name);
    if (existingContainer) {
      throw new BadRequestException(
        `이미 관리 중인 인스턴스 이름입니다: ${config.name}`,
      );
    }

    if (this.composeService.hasService(config.name)) {
      throw new BadRequestException(
        `이미 compose에 존재하는 서비스입니다: ${config.name}`,
      );
    }

    await this.composeService.ensurePortsAvailable(config.ports);
  }

  private async waitForContainer(name: string) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const containers = await this.dockerClient.listContainers(true);
      const container = containers.find((item) => item.name === name);

      if (container) {
        return container;
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    throw new BadRequestException(`생성한 컨테이너를 찾지 못했습니다: ${name}`);
  }
}
