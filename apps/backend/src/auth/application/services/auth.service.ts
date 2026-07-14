import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '../../../rbac/domain/repositories/user.repository.interface';
import {
  IRoleRepository,
  ROLE_REPOSITORY,
} from '../../../rbac/domain/repositories/role.repository.interface';
import { LoginDto, RegisterDto } from '../dto';
import { ROLES } from '../../../common/constants/roles';

@Injectable()
export class AuthService {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: IRoleRepository,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * 회원가입
   */
  async register(dto: RegisterDto) {
    const { email, password } = dto;
    const roleName = ROLES.READ_ONLY;

    // 비밀번호 해시
    const hashedPassword = await bcrypt.hash(password, 10);

    // 공개 회원가입은 항상 읽기 전용 역할로 시작한다.
    // 요청 body로 역할을 받으면 신규 사용자가 관리자 권한을 주입할 수 있다.
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

    return { email: user.email, id: user.id };
  }

  /**
   * 로그인
   */
  async login(dto: LoginDto) {
    const { email, password } = dto;

    const user = await this.userRepository.findByEmailWithRoles(email);

    if (!user) {
      throw new UnauthorizedException(
        '이메일 또는 비밀번호가 올바르지 않습니다.',
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException(
        '이메일 또는 비밀번호가 올바르지 않습니다.',
      );
    }

    // JWT 토큰 생성
    const payload = {
      sub: user.id,
      email: user.email,
      roles: user.roles.map((r) => r.name),
      permissions: user.roles.flatMap((r) => r.permissions.map((p) => p.name)),
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        roles: user.roles.map((r) => r.name),
        permissions: user.roles.flatMap((r) =>
          r.permissions.map((p) => p.name),
        ),
      },
    };
  }

  /**
   * JWT 검증
   */
  async validateUser(userId: string) {
    return this.userRepository.findById(userId);
  }

  /**
   * 권한 확인
   */
  async hasPermission(
    userId: string,
    permissionName: string,
  ): Promise<boolean> {
    const user = await this.userRepository.findById(userId);

    if (!user) return false;

    // Admin은 모든 권한
    if (user.roles.some((r) => r.name === 'admin')) return true;

    // 특정 권한 확인
    return user.roles.some((role) =>
      role.permissions.some((p) => p.name === permissionName),
    );
  }
}
