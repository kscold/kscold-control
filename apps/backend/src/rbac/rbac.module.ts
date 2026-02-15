import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Domain Layer
import { User } from './domain/entities/user.entity';
import { Role } from './domain/entities/role.entity';
import { Permission } from './domain/entities/permission.entity';
import { USER_REPOSITORY } from './domain/repositories/user.repository.interface';
import { ROLE_REPOSITORY } from './domain/repositories/role.repository.interface';

// Application Layer
import {
  CreateUserUseCase,
  UpdateUserUseCase,
  DeleteUserUseCase,
  ListUsersUseCase,
  AssignRolesUseCase,
  ListRolesUseCase,
  ManageTerminalLimitUseCase,
} from './application/use-cases';
import { RbacSeedService } from './application/services/rbac-seed.service';

// Infrastructure Layer
import {
  TypeOrmUserRepository,
  TypeOrmRoleRepository,
} from './infrastructure/repositories';

// Presentation Layer
import { RbacController } from './presentation/controllers/rbac.controller';

/**
 * RBAC Module
 * Clean Architecture implementation
 *
 * Dependencies:
 * - Domain: Entities, Repository Interfaces (no dependencies)
 * - Application: Use Cases, DTOs, Services (depends on Domain)
 * - Infrastructure: Repository implementations (depends on Application)
 * - Presentation: Controllers (depends on Application)
 */
@Module({
  imports: [TypeOrmModule.forFeature([User, Role, Permission])],
  controllers: [RbacController],
  providers: [
    // Use Cases
    CreateUserUseCase,
    UpdateUserUseCase,
    DeleteUserUseCase,
    ListUsersUseCase,
    AssignRolesUseCase,
    ListRolesUseCase,
    ManageTerminalLimitUseCase,

    // Application Services
    RbacSeedService,

    // Repository Implementations (DI)
    {
      provide: USER_REPOSITORY,
      useClass: TypeOrmUserRepository,
    },
    {
      provide: ROLE_REPOSITORY,
      useClass: TypeOrmRoleRepository,
    },
  ],
  exports: [
    // Export repository tokens for other modules (e.g., TerminalModule)
    USER_REPOSITORY,

    // Export use cases for potential reuse in other modules
    CreateUserUseCase,
    UpdateUserUseCase,
    DeleteUserUseCase,
    ListUsersUseCase,
    AssignRolesUseCase,
    ListRolesUseCase,
    ManageTerminalLimitUseCase,
  ],
})
export class RbacModule implements OnModuleInit {
  constructor(private readonly rbacSeedService: RbacSeedService) {}

  async onModuleInit() {
    // Seed initial RBAC data on application startup
    await this.rbacSeedService.seedInitialData();
  }
}
