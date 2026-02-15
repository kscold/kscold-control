import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Role } from '../entities/role.entity';
import { Permission } from '../entities/permission.entity';
import { User } from '../entities/user.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class RbacService {
  constructor(
    @InjectRepository(Role)
    private roleRepo: Repository<Role>,
    @InjectRepository(Permission)
    private permissionRepo: Repository<Permission>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  async getAllRoles() {
    return this.roleRepo.find({ relations: ['permissions'] });
  }

  async createRole(
    name: string,
    description: string | undefined,
    permissionIds: string[],
  ) {
    const permissions = await this.permissionRepo.findBy({
      id: In(permissionIds),
    });
    const role = this.roleRepo.create({ name, description, permissions });
    return this.roleRepo.save(role);
  }

  async updateRole(
    id: string,
    data: { name?: string; description?: string; permissionIds?: string[] },
  ) {
    const role = await this.roleRepo.findOne({
      where: { id },
      relations: ['permissions'],
    });
    if (!role) throw new Error('Role not found');

    if (data.name) role.name = data.name;
    if (data.description !== undefined) role.description = data.description;
    if (data.permissionIds) {
      const permissions = await this.permissionRepo.findBy({
        id: In(data.permissionIds),
      });
      role.permissions = permissions;
    }

    return this.roleRepo.save(role);
  }

  async deleteRole(id: string) {
    await this.roleRepo.delete(id);
    return { success: true };
  }

  async getAllPermissions() {
    return this.permissionRepo.find();
  }

  async assignRolesToUser(userId: string, roleIds: string[]) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['roles'],
    });
    if (!user) throw new Error('User not found');

    const roles = await this.roleRepo.findBy({ id: In(roleIds) });
    user.roles = roles;

    // Guest 역할이 할당되면 터미널 명령어 제한을 10으로 설정
    const hasGuestRole = roles.some((role) => role.name === 'guest');
    if (hasGuestRole && user.terminalCommandLimit === -1) {
      user.terminalCommandLimit = 10;
      user.terminalCommandCount = 0;
    }

    return this.userRepo.save(user);
  }

  async getAllUsersWithRoles() {
    return this.userRepo.find({ relations: ['roles', 'roles.permissions'] });
  }

  async createUser(email: string, password: string, roleIds?: string[]) {
    // 이메일 중복 체크
    const existingUser = await this.userRepo.findOne({ where: { email } });
    if (existingUser) {
      throw new Error('Email already exists');
    }

    // 비밀번호 해싱
    const hashedPassword = await bcrypt.hash(password, 10);

    // 역할 가져오기
    let roles: Role[] = [];
    if (roleIds && roleIds.length > 0) {
      roles = await this.roleRepo.findBy({ id: In(roleIds) });
    }

    // Guest role인 경우 터미널 명령어 제한 설정
    const guestRole = await this.roleRepo.findOne({ where: { name: 'guest' } });
    const isGuest = roles.some((role) => role.id === guestRole?.id);

    // 사용자 생성
    const user = this.userRepo.create({
      email,
      password: hashedPassword,
      roles,
      terminalCommandCount: 0,
      terminalCommandLimit: isGuest ? 10 : -1, // Guest는 10회 제한, 나머지는 무제한
    });

    return this.userRepo.save(user);
  }

  async updateUser(id: string, data: { email?: string; password?: string }) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new Error('User not found');

    if (data.email) {
      // 이메일 중복 체크
      const existingUser = await this.userRepo.findOne({
        where: { email: data.email },
      });
      if (existingUser && existingUser.id !== id) {
        throw new Error('Email already exists');
      }
      user.email = data.email;
    }

    if (data.password) {
      user.password = await bcrypt.hash(data.password, 10);
    }

    return this.userRepo.save(user);
  }

  async deleteUser(id: string) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new Error('User not found');

    await this.userRepo.delete(id);
    return { success: true };
  }

  // 초기 데이터 시딩
  async seedInitialData() {
    // 권한 생성
    const permissions = [
      { name: 'docker:read', description: 'Docker 컨테이너 조회' },
      { name: 'docker:create', description: 'Docker 컨테이너 생성' },
      {
        name: 'docker:update',
        description: 'Docker 컨테이너 수정 (시작/중지)',
      },
      { name: 'docker:delete', description: 'Docker 컨테이너 삭제' },
      { name: 'terminal:access', description: '터미널 접근' },
      { name: 'rbac:manage', description: 'RBAC 관리' },
      { name: 'system:read', description: '시스템 정보 및 로그 조회' },
    ];

    for (const perm of permissions) {
      const exists = await this.permissionRepo.findOne({
        where: { name: perm.name },
      });
      if (!exists) {
        await this.permissionRepo.save(this.permissionRepo.create(perm));
      }
    }

    // 역할 생성
    const allPermissions = await this.permissionRepo.find();

    // Super Admin - 모든 권한
    let superAdminRole = await this.roleRepo.findOne({
      where: { name: 'super_admin' },
      relations: ['permissions'],
    });
    if (!superAdminRole) {
      await this.roleRepo.save(
        this.roleRepo.create({
          name: 'super_admin',
          description: '모든 권한 (생성/수정/삭제/터미널)',
          permissions: allPermissions,
        }),
      );
    } else {
      // 기존 역할이 있으면 모든 권한으로 업데이트
      superAdminRole.permissions = allPermissions;
      await this.roleRepo.save(superAdminRole);
    }

    // Read Only - 읽기만 가능
    const readOnlyPerms = allPermissions.filter(
      (p) => p.name === 'docker:read',
    );
    const readOnlyRole = await this.roleRepo.findOne({
      where: { name: 'read_only' },
    });
    if (!readOnlyRole) {
      await this.roleRepo.save(
        this.roleRepo.create({
          name: 'read_only',
          description: '읽기 전용',
          permissions: readOnlyPerms,
        }),
      );
    }

    // Operator - 시작/중지만 가능
    const operatorPerms = allPermissions.filter(
      (p) => p.name === 'docker:read' || p.name === 'docker:update',
    );
    const operatorRole = await this.roleRepo.findOne({
      where: { name: 'operator' },
    });
    if (!operatorRole) {
      await this.roleRepo.save(
        this.roleRepo.create({
          name: 'operator',
          description: '컨테이너 시작/중지 가능',
          permissions: operatorPerms,
        }),
      );
    }

    // Terminal Only - 터미널만 접근 가능
    const terminalPerms = allPermissions.filter(
      (p) => p.name === 'terminal:access',
    );
    const terminalRole = await this.roleRepo.findOne({
      where: { name: 'terminal_only' },
    });
    if (!terminalRole) {
      await this.roleRepo.save(
        this.roleRepo.create({
          name: 'terminal_only',
          description: '터미널 접근만 가능',
          permissions: terminalPerms,
        }),
      );
    }

    // Guest - 구경 전용 (읽기만 가능, 터미널 10회 제한)
    const guestPerms = allPermissions.filter(
      (p) =>
        p.name === 'docker:read' ||
        p.name === 'terminal:access' ||
        p.name === 'system:read',
    );
    const guestRole = await this.roleRepo.findOne({ where: { name: 'guest' } });
    if (!guestRole) {
      await this.roleRepo.save(
        this.roleRepo.create({
          name: 'guest',
          description: '구경 전용 (읽기만 가능, 터미널 10회 제한)',
          permissions: guestPerms,
        }),
      );
    }

    // admin@kscold.dev를 super_admin으로 설정
    const adminUser = await this.userRepo.findOne({
      where: { email: 'admin@kscold.dev' },
      relations: ['roles'],
    });
    if (adminUser) {
      const superAdmin = await this.roleRepo.findOne({
        where: { name: 'super_admin' },
      });
      if (superAdmin && !adminUser.roles.find((r) => r.id === superAdmin.id)) {
        adminUser.roles.push(superAdmin);
        await this.userRepo.save(adminUser);
        console.log('[RBAC] admin@kscold.dev assigned to super_admin role');
      }
    }

    console.log('[RBAC] Initial data seeded successfully');
  }

  // 터미널 명령어 카운트 리셋
  async resetTerminalCommandCount(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    user.terminalCommandCount = 0;
    await this.userRepo.save(user);
    return {
      success: true,
      terminalCommandCount: 0,
      terminalCommandLimit: user.terminalCommandLimit,
    };
  }

  // 터미널 명령어 제한 설정
  async setTerminalCommandLimit(userId: string, limit: number) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    user.terminalCommandLimit = limit;
    await this.userRepo.save(user);
    return { success: true, terminalCommandLimit: limit };
  }

  // 터미널 명령어 증가
  async incrementTerminalCommandCount(
    userId: string,
  ): Promise<{ allowed: boolean; remaining: number }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    // 제한이 -1이면 무제한
    if (user.terminalCommandLimit === -1) {
      user.terminalCommandCount++;
      await this.userRepo.save(user);
      return { allowed: true, remaining: -1 };
    }

    // 제한 확인
    if (user.terminalCommandCount >= user.terminalCommandLimit) {
      return { allowed: false, remaining: 0 };
    }

    user.terminalCommandCount++;
    await this.userRepo.save(user);
    const remaining = user.terminalCommandLimit - user.terminalCommandCount;
    return { allowed: true, remaining };
  }
}
