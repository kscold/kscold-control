import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ROLES } from '../../../common/constants/roles';
import {
  IRoleRepository,
  ROLE_REPOSITORY,
} from '../../domain/repositories/role.repository.interface';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '../../domain/repositories/user.repository.interface';
import { UserResponseDto } from '../dto/user-response.dto';

/** 승인 대기 사용자를 GoLe 키 관리자 역할로 전환한다. */
@Injectable()
export class ApproveKeyManagerUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: IRoleRepository,
  ) {}

  async execute(userId: string): Promise<UserResponseDto> {
    const user = await this.userRepository.findByIdWithRoles(userId);
    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    const isPending = user.roles.some(
      (role) => role.name === ROLES.PENDING_APPROVAL,
    );
    if (!isPending) {
      throw new BadRequestException('승인 대기 중인 사용자가 아닙니다.');
    }

    const keyManagerRole = await this.roleRepository.findByNameWithPermissions(
      ROLES.KEY_MANAGER,
    );
    if (!keyManagerRole) {
      throw new NotFoundException('키 관리자 역할이 준비되지 않았습니다.');
    }

    // 승인 대기 역할을 포함한 기존 역할을 모두 제거해 최소 권한으로 시작한다.
    user.roles = [keyManagerRole];
    const saved = await this.userRepository.save(user);
    saved.roles = [keyManagerRole];

    return UserResponseDto.fromEntity(saved, true);
  }
}
