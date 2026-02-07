import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from '../entities/user.entity';
import { Role } from '../entities/role.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Role)
    private roleRepo: Repository<Role>,
    private jwtService: JwtService,
  ) {}

  /**
   * 회원가입
   */
  async register(email: string, password: string, roleName = 'user') {
    // 비밀번호 해시
    const hashedPassword = await bcrypt.hash(password, 10);

    // Role 조회 또는 생성
    let role = await this.roleRepo.findOne({ where: { name: roleName } });
    if (!role) {
      role = this.roleRepo.create({ name: roleName });
      await this.roleRepo.save(role);
    }

    // User 생성
    const user = this.userRepo.create({
      email,
      password: hashedPassword,
      roles: [role],
    });

    await this.userRepo.save(user);

    return { email: user.email, id: user.id };
  }

  /**
   * 로그인
   */
  async login(email: string, password: string) {
    const user = await this.userRepo.findOne({
      where: { email },
      relations: ['roles', 'roles.permissions'],
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
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
      },
    };
  }

  /**
   * JWT 검증
   */
  async validateUser(userId: string) {
    return this.userRepo.findOne({
      where: { id: userId },
      relations: ['roles', 'roles.permissions'],
    });
  }

  /**
   * 권한 확인
   */
  async hasPermission(
    userId: string,
    permissionName: string,
  ): Promise<boolean> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['roles', 'roles.permissions'],
    });

    if (!user) return false;

    // Admin은 모든 권한
    if (user.roles.some((r) => r.name === 'admin')) return true;

    // 특정 권한 확인
    return user.roles.some((role) =>
      role.permissions.some((p) => p.name === permissionName),
    );
  }
}
