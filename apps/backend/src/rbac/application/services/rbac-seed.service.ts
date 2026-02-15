import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Permission } from '../../domain/entities/permission.entity';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '../../domain/repositories/user.repository.interface';
import {
  IRoleRepository,
  ROLE_REPOSITORY,
} from '../../domain/repositories/role.repository.interface';

/**
 * RBAC Seed Service
 * Application service for seeding initial RBAC data
 */
@Injectable()
export class RbacSeedService {
  constructor(
    @InjectRepository(Permission)
    private readonly permissionRepo: Repository<Permission>,
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: IRoleRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {}

  /**
   * Seed initial permissions, roles, and assign admin role
   */
  async seedInitialData(): Promise<void> {
    // Create permissions
    const permissionData = [
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

    for (const perm of permissionData) {
      const exists = await this.permissionRepo.findOne({
        where: { name: perm.name },
      });
      if (!exists) {
        await this.permissionRepo.save(this.permissionRepo.create(perm));
      }
    }

    // Get all permissions
    const allPermissions = await this.permissionRepo.find();

    // Create Super Admin role - all permissions
    let superAdminRole =
      await this.roleRepository.findByNameWithPermissions('super_admin');
    if (!superAdminRole) {
      superAdminRole = this.roleRepository.create({
        name: 'super_admin',
        description: '모든 권한 (생성/수정/삭제/터미널)',
        permissions: allPermissions,
      });
      await this.roleRepository.save(superAdminRole);
    } else {
      // Update existing role with all permissions
      superAdminRole.permissions = allPermissions;
      await this.roleRepository.save(superAdminRole);
    }

    // Create Read Only role
    const readOnlyPerms = allPermissions.filter(
      (p) => p.name === 'docker:read',
    );
    const readOnlyRole = await this.roleRepository.findByName('read_only');
    if (!readOnlyRole) {
      const role = this.roleRepository.create({
        name: 'read_only',
        description: '읽기 전용',
        permissions: readOnlyPerms,
      });
      await this.roleRepository.save(role);
    }

    // Create Operator role
    const operatorPerms = allPermissions.filter(
      (p) => p.name === 'docker:read' || p.name === 'docker:update',
    );
    const operatorRole = await this.roleRepository.findByName('operator');
    if (!operatorRole) {
      const role = this.roleRepository.create({
        name: 'operator',
        description: '컨테이너 시작/중지 가능',
        permissions: operatorPerms,
      });
      await this.roleRepository.save(role);
    }

    // Create Terminal Only role
    const terminalPerms = allPermissions.filter(
      (p) => p.name === 'terminal:access',
    );
    const terminalRole = await this.roleRepository.findByName('terminal_only');
    if (!terminalRole) {
      const role = this.roleRepository.create({
        name: 'terminal_only',
        description: '터미널 접근만 가능',
        permissions: terminalPerms,
      });
      await this.roleRepository.save(role);
    }

    // Create Guest role
    const guestPerms = allPermissions.filter(
      (p) =>
        p.name === 'docker:read' ||
        p.name === 'terminal:access' ||
        p.name === 'system:read',
    );
    const guestRole = await this.roleRepository.findByName('guest');
    if (!guestRole) {
      const role = this.roleRepository.create({
        name: 'guest',
        description: '구경 전용 (읽기만 가능, 터미널 10회 제한)',
        permissions: guestPerms,
      });
      await this.roleRepository.save(role);
    }

    // Assign admin@kscold.dev to super_admin role
    const adminUser =
      await this.userRepository.findByEmailWithRoles('admin@kscold.dev');
    if (adminUser) {
      const superAdmin = await this.roleRepository.findByName('super_admin');
      if (superAdmin && !adminUser.roles.find((r) => r.id === superAdmin.id)) {
        adminUser.roles.push(superAdmin);
        await this.userRepository.save(adminUser);
        console.log('[RBAC] admin@kscold.dev assigned to super_admin role');
      }
    }

    console.log('[RBAC] Initial data seeded successfully');
  }
}
