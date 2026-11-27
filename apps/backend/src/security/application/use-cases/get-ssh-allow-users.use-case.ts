import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  SSH_ALLOW_USERS,
  type ISshAllowUsersGateway,
} from '../../domain/gateways/ssh-allow-users.gateway.interface';
import { parseSshAllowUsers } from '../../domain/policies/ssh-allow-users.policy';

@Injectable()
export class GetSshAllowUsersUseCase {
  private readonly logger = new Logger(GetSshAllowUsersUseCase.name);

  constructor(
    @Inject(SSH_ALLOW_USERS) private readonly gateway: ISshAllowUsersGateway,
  ) {}

  async execute() {
    let config: string | null;
    try {
      config = await this.gateway.read();
    } catch (error) {
      this.logger.warn(`SSH 허용 규칙 읽기 실패: ${String(error)}`);
      throw new ServiceUnavailableException('SSH 허용 규칙을 읽을 수 없습니다');
    }
    return config === null
      ? { kind: 'unconfigured' as const }
      : parseSshAllowUsers(config);
  }
}
