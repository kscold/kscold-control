import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  DeploymentRun,
  IDeploymentGateway,
  TriggerDeploymentInput,
} from '../../domain/gateways/deployment.gateway.interface';
import { KeyManagementTargetService } from '../../application/services/key-management-target.service';
import { GithubActionsDeploymentGateway } from './github-actions-deployment.gateway';
import { SshBlueGreenDeploymentGateway } from './ssh-blue-green-deployment.gateway';
import { SshEnvCommandGateway } from './ssh-env-command.gateway';

@Injectable()
export class RoutingDeploymentGateway implements IDeploymentGateway {
  constructor(
    private readonly targets: KeyManagementTargetService,
    private readonly github: GithubActionsDeploymentGateway,
    private readonly ssh: SshBlueGreenDeploymentGateway,
    private readonly command: SshEnvCommandGateway,
  ) {}

  async trigger(input: TriggerDeploymentInput): Promise<void> {
    return (await this.gateway(input.targetId)).trigger(input);
  }

  async findByRequestId(
    targetId: string,
    requestId: string,
  ): Promise<DeploymentRun | null> {
    return (await this.gateway(targetId)).findByRequestId(targetId, requestId);
  }

  private async gateway(targetId: string): Promise<IDeploymentGateway> {
    const target = await this.targets.get(targetId);
    if (target.deploymentProvider === 'github-actions') return this.github;
    if (target.deploymentProvider === 'ssh-blue-green') return this.ssh;
    if (target.deploymentProvider === 'ssh-env-command') return this.command;
    throw new ServiceUnavailableException(
      '지원하지 않는 운영 배포 방식입니다.',
    );
  }
}
