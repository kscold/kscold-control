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
import { ComposeService } from '../services/compose.service';
import { PortForwardingService } from '../services/port-forwarding.service';

/**
 * compose 기반 Ubuntu 인스턴스를 안전하게 제거함.
 */
@Injectable()
export class RemoveComposeServiceUseCase {
  private readonly logger = new Logger(RemoveComposeServiceUseCase.name);

  constructor(
    @Inject(CONTAINER_REPOSITORY)
    private readonly containerRepo: IContainerRepository,
    private readonly composeService: ComposeService,
    private readonly portForwardingService: PortForwardingService,
  ) {}

  async execute(name: string): Promise<{ output: string }> {
    if (!this.composeService.hasService(name)) {
      throw new BadRequestException(`compose에 없는 서비스입니다: ${name}`);
    }

    const managedContainer = await this.containerRepo.findByName(name);
    const output = await this.composeService.downService(name);
    this.composeService.removeService(name);

    if (managedContainer) {
      await this.portForwardingService.removePortForwardingRules(name);
      await this.containerRepo.delete(managedContainer.id);
      this.logger.log(`compose 서비스와 관리 정보를 제거했습니다: ${name}`);
    }

    return { output };
  }
}
