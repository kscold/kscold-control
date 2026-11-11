import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '../../domain/repositories/user.repository.interface';
import {
  IRoleRepository,
  ROLE_REPOSITORY,
} from '../../domain/repositories/role.repository.interface';
import { AssignRolesDto } from '../dto/assign-roles.dto';
import { UserResponseDto } from '../dto/user-response.dto';
import { ROLES } from '../../../common/constants/roles';
import { AuthSessionService } from '../../../auth/application/services/auth-session.service';
import { MfaConfig } from '../../../auth/mfa/application/mfa-config';

/**
 * Assign Roles Use Case
 * Business logic for assigning roles to users
 */
@Injectable()
export class AssignRolesUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: IRoleRepository,
    private readonly authSessions: AuthSessionService,
    private readonly mfa: MfaConfig,
  ) {}

  async execute(dto: AssignRolesDto): Promise<UserResponseDto> {
    // Find user
    const user = await this.userRepository.findByIdWithRoles(dto.userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Find roles
    const roles = await this.roleRepository.findByIds(dto.roleIds);
    const newlyRequiresMfa = this.mfa.newlyRequiresMfa(
      user.roles.map((role) => role.name),
      roles.map((role) => role.name),
    );
    user.roles = roles;

    // 키 관리자는 역할 편집 경로에서도 터미널을 기본 차단한다.
    const hasKeyManagerRole = roles.some(
      (role) => role.name === ROLES.KEY_MANAGER,
    );
    const hasGuestRole = roles.some((role) => role.name === ROLES.GUEST);
    if (hasKeyManagerRole) {
      user.terminalCommandLimit = 0;
      user.terminalCommandCount = 0;
    } else if (hasGuestRole && user.terminalCommandLimit === -1) {
      user.terminalCommandLimit = 10;
      user.terminalCommandCount = 0;
    }

    const updatedUser = await this.userRepository.save(user);
    // 저장 전에 끊으면 그 사이 비밀번호만으로 새로 연 세션이 예전 역할로 살아남는다.
    if (newlyRequiresMfa) await this.authSessions.revokeAllForUser(user.id);

    return UserResponseDto.fromEntity(updatedUser, true);
  }
}
