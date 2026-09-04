import { ConflictException, Inject, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '../../../rbac/domain/repositories/user.repository.interface';
import {
  IRoleRepository,
  ROLE_REPOSITORY,
} from '../../../rbac/domain/repositories/role.repository.interface';
import { RegisterDto } from '../dto';
import { ROLES } from '../../../common/constants/roles';

/** 회원가입 */
@Injectable()
export class RegisterUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: IRoleRepository,
  ) {}

  async execute(dto: RegisterDto) {
    const { email, password } = dto;
    const roleName = ROLES.PENDING_APPROVAL;

    const existingUser = await this.userRepository.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('이미 가입된 이메일입니다.');
    }

    // 비밀번호 해시
    const hashedPassword = await bcrypt.hash(password, 10);

    // 공개 회원가입은 항상 승인 대기 역할로 시작한다.
    // 요청 body로 역할을 받으면 신규 사용자가 운영 권한을 주입할 수 있다.
    let role = await this.roleRepository.findByName(roleName);
    if (!role) {
      role = this.roleRepository.create({ name: roleName });
      await this.roleRepository.save(role);
    }

    // User 생성
    const user = this.userRepository.create({
      email,
      password: hashedPassword,
      roles: [role],
    });

    await this.userRepository.save(user);

    return {
      email: user.email,
      id: user.id,
      status: ROLES.PENDING_APPROVAL,
    };
  }
}
