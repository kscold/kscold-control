import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  SSH_ALLOW_USERS,
  type ISshAllowUsersGateway,
} from '../../domain/gateways/ssh-allow-users.gateway.interface';
import { parseSshAllowUsers } from '../../domain/policies/ssh-allow-users.policy';

export function sshAllowUsersRevision(config: string): string {
  return createHash('sha256').update(config).digest('hex');
}

@Injectable()
export class GetSshAllowUsersUseCase {
  private readonly logger = new Logger(GetSshAllowUsersUseCase.name);

  constructor(
    @Inject(SSH_ALLOW_USERS) private readonly gateway: ISshAllowUsersGateway,
  ) {}

  async execute() {
    const config = await this.readConfig();
    if (config === null) return { kind: 'unconfigured' as const };
    const policy = parseSshAllowUsers(config);
    if (policy.kind !== 'managed') return policy;
    const protectedRule = this.gateway.protectedRule();
    const editable = policy.rules.some(
      ({ user, source }) => `${user}@${source}` === protectedRule,
    );
    return {
      ...policy,
      ...(editable
        ? { revision: sshAllowUsersRevision(config), protectedRule }
        : {}),
    };
  }

  async readConfig(): Promise<string | null> {
    try {
      return await this.gateway.read();
    } catch (error) {
      this.logger.warn(`SSH 허용 규칙 읽기 실패: ${String(error)}`);
      throw new ServiceUnavailableException('SSH 허용 규칙을 읽을 수 없습니다');
    }
  }
}
