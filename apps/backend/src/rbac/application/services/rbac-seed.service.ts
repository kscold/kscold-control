import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  IPermissionRepository,
  PERMISSION_REPOSITORY,
} from '../../domain/repositories/permission.repository.interface';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '../../domain/repositories/user.repository.interface';
import {
  IRoleRepository,
  ROLE_REPOSITORY,
} from '../../domain/repositories/role.repository.interface';
import { ROLES } from '../../../common/constants/roles';
import { PERMISSIONS } from '../../../common/constants/permissions';

/**
 * RBAC Seed Service
 * Application service for seeding initial RBAC data
 */
@Injectable()
export class RbacSeedService {
  private readonly logger = new Logger(RbacSeedService.name);

  constructor(
    @Inject(PERMISSION_REPOSITORY)
    private readonly permissionRepo: IPermissionRepository,
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: IRoleRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {}

  /**
   * Seed initial permissions, roles, and assign admin role
   */
  async seedInitialData(): Promise<void> {
    const permissionDescriptions: Record<string, string> = {
      [PERMISSIONS.CLAUDE_EXECUTE]: 'Claude/AI 실행',
      [PERMISSIONS.DOCKER_READ]: 'Docker 컨테이너 조회',
      [PERMISSIONS.DOCKER_READ_ALL]: '전체 Docker 컨테이너 조회',
      [PERMISSIONS.DOCKER_CREATE]: 'Docker 컨테이너 생성',
      [PERMISSIONS.DOCKER_UPDATE]: 'Docker 컨테이너 수정 (시작/중지)',
      [PERMISSIONS.DOCKER_DELETE]: 'Docker 컨테이너 삭제',
      [PERMISSIONS.SESSION_READ]: '세션 조회',
      [PERMISSIONS.SESSION_WRITE]: '세션 기록',
      [PERMISSIONS.USER_MANAGE]: '사용자 관리',
      [PERMISSIONS.SYSTEM_READ]: '시스템 정보 및 로그 조회',
      [PERMISSIONS.SYSTEM_WRITE]: '시스템/Nginx/네트워크 설정 변경',
      [PERMISSIONS.TERMINAL_ACCESS]: '터미널 접근',
      [PERMISSIONS.RBAC_MANAGE]: 'RBAC 관리',
      [PERMISSIONS.REPOSITORY_READ]: '소스 저장소 조회/다운로드',
      [PERMISSIONS.REPOSITORY_WRITE]: '소스 저장소 업로드',
      [PERMISSIONS.REPOSITORY_DELETE]: '소스 저장소 삭제',
      [PERMISSIONS.SECURITY_READ]: 'IP 차단 목록 조회',
      [PERMISSIONS.SECURITY_MANAGE]: 'IP 차단 관리',
    };

    for (const name of Object.values(PERMISSIONS)) {
      const exists = await this.permissionRepo.findByName(name);
      if (!exists) {
        await this.permissionRepo.save(
          this.permissionRepo.create({
            name,
            description: permissionDescriptions[name] ?? name,
          }),
        );
      }
    }

    // Get all permissions
    const allPermissions = await this.permissionRepo.findAll();

    // Create Super Admin role - all permissions
    let superAdminRole = await this.roleRepository.findByNameWithPermissions(
      ROLES.SUPER_ADMIN,
    );
    if (!superAdminRole) {
      superAdminRole = this.roleRepository.create({
        name: ROLES.SUPER_ADMIN,
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
      (p) =>
        p.name === PERMISSIONS.DOCKER_READ ||
        p.name === PERMISSIONS.SYSTEM_READ ||
        p.name === PERMISSIONS.REPOSITORY_READ ||
        p.name === PERMISSIONS.SECURITY_READ,
    );
    const readOnlyRole = await this.roleRepository.findByName(ROLES.READ_ONLY);
    if (!readOnlyRole) {
      const role = this.roleRepository.create({
        name: ROLES.READ_ONLY,
        description: '읽기 전용',
        permissions: readOnlyPerms,
      });
      await this.roleRepository.save(role);
    }

    // Create Operator role
    const operatorPerms = allPermissions.filter(
      (p) =>
        p.name === PERMISSIONS.DOCKER_READ ||
        p.name === PERMISSIONS.DOCKER_UPDATE ||
        p.name === PERMISSIONS.SYSTEM_READ ||
        p.name === PERMISSIONS.REPOSITORY_READ ||
        p.name === PERMISSIONS.SECURITY_READ,
    );
    const operatorRole = await this.roleRepository.findByName(ROLES.OPERATOR);
    if (!operatorRole) {
      const role = this.roleRepository.create({
        name: ROLES.OPERATOR,
        description: '컨테이너 시작/중지 가능',
        permissions: operatorPerms,
      });
      await this.roleRepository.save(role);
    }

    // Create Terminal Only role
    const terminalPerms = allPermissions.filter(
      (p) => p.name === PERMISSIONS.TERMINAL_ACCESS,
    );
    const terminalRole = await this.roleRepository.findByName(
      ROLES.TERMINAL_ONLY,
    );
    if (!terminalRole) {
      const role = this.roleRepository.create({
        name: ROLES.TERMINAL_ONLY,
        description: '터미널 접근만 가능',
        permissions: terminalPerms,
      });
      await this.roleRepository.save(role);
    }

    // Create Guest role
    const guestPerms = allPermissions.filter(
      (p) =>
        p.name === PERMISSIONS.DOCKER_READ ||
        p.name === PERMISSIONS.TERMINAL_ACCESS ||
        p.name === PERMISSIONS.SYSTEM_READ,
    );
    const guestRole = await this.roleRepository.findByName(ROLES.GUEST);
    if (!guestRole) {
      const role = this.roleRepository.create({
        name: ROLES.GUEST,
        description: '구경 전용 (읽기만 가능, 터미널 10회 제한)',
        permissions: guestPerms,
      });
      await this.roleRepository.save(role);
    }

    // Assign admin@kscold.dev to super_admin role
    const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@kscold.dev';
    const adminUser =
      await this.userRepository.findByEmailWithRoles(adminEmail);
    if (adminUser) {
      const superAdmin = await this.roleRepository.findByName(
        ROLES.SUPER_ADMIN,
      );
      if (superAdmin && !adminUser.roles.find((r) => r.id === superAdmin.id)) {
        adminUser.roles.push(superAdmin);
        await this.userRepository.save(adminUser);
        this.logger.log('admin@kscold.dev assigned to super_admin role');
      }
    }

    this.logger.log('Initial data seeded successfully');
  }
}
