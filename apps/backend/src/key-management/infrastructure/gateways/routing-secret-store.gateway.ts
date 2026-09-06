import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  AddedSecretVersion,
  ISecretStoreGateway,
  SecretStoreVersion,
} from '../../domain/gateways/secret-store.gateway.interface';
import { KeyManagementTargetService } from '../../application/services/key-management-target.service';
import { GcpSecretManagerGateway } from './gcp-secret-manager.gateway';
import { SshEnvFileSecretStoreGateway } from './ssh-env-file-secret-store.gateway';

@Injectable()
export class RoutingSecretStoreGateway implements ISecretStoreGateway {
  constructor(
    private readonly targets: KeyManagementTargetService,
    private readonly gcp: GcpSecretManagerGateway,
    private readonly ssh: SshEnvFileSecretStoreGateway,
  ) {}

  async readLatest(targetId: string): Promise<SecretStoreVersion> {
    return (await this.gateway(targetId)).readLatest(targetId);
  }

  async readVersion(
    targetId: string,
    version: string,
  ): Promise<SecretStoreVersion> {
    return (await this.gateway(targetId)).readVersion(targetId, version);
  }

  async addVersion(
    targetId: string,
    payload: string,
    expectedVersion: string,
  ): Promise<AddedSecretVersion> {
    return (await this.gateway(targetId)).addVersion(
      targetId,
      payload,
      expectedVersion,
    );
  }

  private async gateway(targetId: string): Promise<ISecretStoreGateway> {
    const target = await this.targets.get(targetId);
    if (target.provider === 'gcp-secret-manager') return this.gcp;
    if (target.provider === 'ssh-env-file') return this.ssh;
    throw new ServiceUnavailableException(
      '지원하지 않는 운영 시크릿 저장소입니다.',
    );
  }
}
