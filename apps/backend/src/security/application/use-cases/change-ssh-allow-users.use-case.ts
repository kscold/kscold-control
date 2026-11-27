import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  SSH_ALLOW_USERS,
  type ISshAllowUsersGateway,
} from '../../domain/gateways/ssh-allow-users.gateway.interface';
import {
  planSshAllowUsersChange,
  type SshAllowUsersChange,
} from '../../domain/policies/ssh-allow-users.policy';
import {
  GetSshAllowUsersUseCase,
  sshAllowUsersRevision,
} from './get-ssh-allow-users.use-case';

@Injectable()
export class ChangeSshAllowUsersUseCase {
  constructor(
    @Inject(SSH_ALLOW_USERS) private readonly gateway: ISshAllowUsersGateway,
    private readonly getAllowUsers: GetSshAllowUsersUseCase,
  ) {}

  async execute(change: SshAllowUsersChange, revision: string) {
    const protectedRule = this.gateway.protectedRule();
    if (!protectedRule) {
      throw new ServiceUnavailableException(
        'SSH 허용 규칙 편집이 연결되지 않았습니다',
      );
    }
    const current = await this.getAllowUsers.readConfig();
    if (current === null || sshAllowUsersRevision(current) !== revision) {
      throw new ConflictException('SSH 허용 규칙을 다시 조회한 뒤 변경하세요');
    }
    const plan = planSshAllowUsersChange(current, protectedRule, change);
    switch (plan.kind) {
      case 'invalid-rule':
        throw new BadRequestException(
          '계정과 출발지 IP 또는 CIDR을 확인하세요',
        );
      case 'protected':
        throw new ConflictException('연결을 유지하는 보호 규칙을 확인하세요');
      case 'unsupported':
        throw new ConflictException('이 파일은 화면에서 편집할 수 없습니다');
      case 'unchanged':
        return { changed: false };
      case 'changed': {
        const status = await this.gateway.apply(revision, plan.config);
        if (status === 'conflict') {
          throw new ConflictException(
            'SSH 허용 규칙을 다시 조회한 뒤 변경하세요',
          );
        }
        if (status !== 'applied') {
          throw new ServiceUnavailableException(
            'SSH 허용 규칙 적용에 실패했습니다',
          );
        }
        return { changed: true };
      }
    }
  }
}
