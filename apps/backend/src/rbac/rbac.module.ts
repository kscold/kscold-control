import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Domain 계층
import { User } from './domain/entities/user.entity';
import { Role } from './domain/entities/role.entity';
import { Permission } from './domain/entities/permission.entity';
import { KeyManagementTargetAccess } from './domain/entities/key-management-target-access.entity';
import { KEY_MANAGEMENT_TARGET_ACCESS_REPOSITORY } from './domain/repositories/key-management-target-access.repository.interface';
import { USER_REPOSITORY } from './domain/repositories/user.repository.interface';
import { ROLE_REPOSITORY } from './domain/repositories/role.repository.interface';
import { PERMISSION_REPOSITORY } from './domain/repositories/permission.repository.interface';

// Application 계층
import {
  CreateUserUseCase,
  UpdateUserUseCase,
  DeleteUserUseCase,
  ListUsersUseCase,
  AssignRolesUseCase,
  ListRolesUseCase,
  ListPermissionsUseCase,
  ManageTerminalLimitUseCase,
  ApproveKeyManagerUseCase,
} from './application/use-cases';
import { RbacSeedService } from './application/services/rbac-seed.service';
import { WsPermissionService } from './application/services/ws-permission.service';
import { KeyManagementTargetAccessService } from './application/services/key-management-target-access.service';

// Infrastructure 계층
import {
  TypeOrmUserRepository,
  TypeOrmRoleRepository,
} from './infrastructure/repositories';
import { TypeOrmPermissionRepository } from './infrastructure/repositories/typeorm-permission.repository';
import { TypeOrmKeyManagementTargetAccessRepository } from './infrastructure/repositories/typeorm-key-management-target-access.repository';

// Presentation 계층
import { RbacController } from './presentation/controllers/rbac.controller';

/**
 * RBAC 모듈
 * 클린 아키텍처 구성
 *
 * 의존 관계:
 * - Domain: 엔티티, 리포지토리 인터페이스 (의존 없음)
 * - Application: 유스케이스, DTO, 서비스 (Domain에 의존)
 * - Infrastructure: 리포지토리 구현체 (Application에 의존)
 * - Presentation: 컨트롤러 (Application에 의존)
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Role,
      Permission,
      KeyManagementTargetAccess,
    ]),
  ],
  controllers: [RbacController],
  providers: [
    // 유스케이스
    CreateUserUseCase,
    UpdateUserUseCase,
    DeleteUserUseCase,
    ListUsersUseCase,
    AssignRolesUseCase,
    ListRolesUseCase,
    ListPermissionsUseCase,
    ManageTerminalLimitUseCase,
    ApproveKeyManagerUseCase,

    // 애플리케이션 서비스
    RbacSeedService,
    KeyManagementTargetAccessService,
    // 웹소켓 권한 확인 — terminal / claude-chat / openai-chat 게이트웨이가 사용
    WsPermissionService,

    // 리포지토리 구현체 (DI)
    {
      provide: USER_REPOSITORY,
      useClass: TypeOrmUserRepository,
    },
    {
      provide: ROLE_REPOSITORY,
      useClass: TypeOrmRoleRepository,
    },
    {
      provide: PERMISSION_REPOSITORY,
      useClass: TypeOrmPermissionRepository,
    },
    {
      provide: KEY_MANAGEMENT_TARGET_ACCESS_REPOSITORY,
      useClass: TypeOrmKeyManagementTargetAccessRepository,
    },
  ],
  exports: [
    // 다른 모듈(예: TerminalModule)을 위한 리포지토리 토큰 공개
    USER_REPOSITORY,
    ROLE_REPOSITORY,

    // 웹소켓 권한 확인 서비스 공개 (terminal / claude-chat / openai-chat 게이트웨이)
    WsPermissionService,
    KeyManagementTargetAccessService,

    // 다른 모듈에서 재사용할 수 있도록 유스케이스 공개
    CreateUserUseCase,
    UpdateUserUseCase,
    DeleteUserUseCase,
    ListUsersUseCase,
    AssignRolesUseCase,
    ListRolesUseCase,
    ManageTerminalLimitUseCase,
    ApproveKeyManagerUseCase,
  ],
})
export class RbacModule implements OnModuleInit {
  constructor(private readonly rbacSeedService: RbacSeedService) {}

  async onModuleInit() {
    // 애플리케이션 기동 시 RBAC 초기 데이터 시딩
    await this.rbacSeedService.seedInitialData();
  }
}
