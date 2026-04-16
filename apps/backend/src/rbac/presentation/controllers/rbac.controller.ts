import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../../common/guards';
import { RequirePermissions } from '../../../common/decorators';
import { PERMISSIONS } from '../../../common/constants/permissions';
import type { JwtRequest } from '../../../common/types/jwt-request.type';
import { AuditLogService } from '../../../audit/application/services/audit-log.service';

// Application Layer
import {
  CreateUserUseCase,
  UpdateUserUseCase,
  DeleteUserUseCase,
  ListUsersUseCase,
  AssignRolesUseCase,
  ListRolesUseCase,
  ManageTerminalLimitUseCase,
} from '../../application/use-cases';
import {
  CreateUserDto,
  UpdateUserDto,
  AssignRolesDto,
} from '../../application/dto';

// Presentation Layer
import { AssignRolesRequestDto, SetTerminalLimitRequestDto } from '../dto';

/**
 * RBAC Controller
 * Presentation layer - handles HTTP concerns only
 * Delegates business logic to Use Cases
 */
@Controller('rbac')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class RbacController {
  constructor(
    // User Use Cases
    private readonly createUserUseCase: CreateUserUseCase,
    private readonly updateUserUseCase: UpdateUserUseCase,
    private readonly deleteUserUseCase: DeleteUserUseCase,
    private readonly listUsersUseCase: ListUsersUseCase,
    private readonly assignRolesUseCase: AssignRolesUseCase,
    // Role Use Cases
    private readonly listRolesUseCase: ListRolesUseCase,
    // Terminal Limit Use Case
    private readonly manageTerminalLimitUseCase: ManageTerminalLimitUseCase,
    private readonly auditLogService: AuditLogService,
  ) {}

  // ==================== Role Endpoints ====================

  /**
   * Get all roles with permissions
   */
  @Get('roles')
  @RequirePermissions(PERMISSIONS.RBAC_MANAGE)
  async getRoles() {
    return this.listRolesUseCase.execute();
  }

  // ==================== User Endpoints ====================

  /**
   * Get all users with roles
   */
  @Get('users')
  @RequirePermissions(PERMISSIONS.RBAC_MANAGE)
  async getUsersWithRoles() {
    return this.listUsersUseCase.execute();
  }

  /**
   * Create a new user
   */
  @Post('users')
  @RequirePermissions(PERMISSIONS.RBAC_MANAGE)
  async createUser(@Body() dto: CreateUserDto, @Request() req: JwtRequest) {
    const result = await this.createUserUseCase.execute(dto);
    await this.auditLogService.record({
      domain: 'rbac',
      action: 'user.create',
      summary: `사용자 ${dto.email}을 생성했습니다.`,
      actorId: req.user?.id ?? req.user?.sub ?? null,
      actorEmail: req.user?.email ?? null,
      targetType: 'user',
      targetId: result.id,
      metadata: {
        after: this.toUserSnapshot(result),
      },
    });
    return result;
  }

  /**
   * Update user information
   */
  @Put('users/:id')
  @RequirePermissions(PERMISSIONS.RBAC_MANAGE)
  async updateUser(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @Request() req: JwtRequest,
  ) {
    const beforeUser = await this.getUserSnapshot(id);
    const result = await this.updateUserUseCase.execute(id, dto);
    await this.auditLogService.record({
      domain: 'rbac',
      action: 'user.update',
      summary: `사용자 ${id} 정보를 수정했습니다.`,
      actorId: req.user?.id ?? req.user?.sub ?? null,
      actorEmail: req.user?.email ?? null,
      targetType: 'user',
      targetId: id,
      metadata: {
        before: beforeUser,
        after: this.toUserSnapshot(result),
        passwordChanged: Boolean(dto.password),
      },
    });
    return result;
  }

  /**
   * Delete a user
   */
  @Delete('users/:id')
  @RequirePermissions(PERMISSIONS.RBAC_MANAGE)
  async deleteUser(@Param('id') id: string, @Request() req: JwtRequest) {
    const beforeUser = await this.getUserSnapshot(id);
    await this.deleteUserUseCase.execute(id);
    await this.auditLogService.record({
      domain: 'rbac',
      action: 'user.delete',
      summary: `사용자 ${id}를 삭제했습니다.`,
      actorId: req.user?.id ?? req.user?.sub ?? null,
      actorEmail: req.user?.email ?? null,
      targetType: 'user',
      targetId: id,
      metadata: {
        before: beforeUser,
      },
    });
    return { success: true };
  }

  /**
   * Assign roles to a user
   */
  @Post('users/:userId/roles')
  @RequirePermissions(PERMISSIONS.RBAC_MANAGE)
  async assignRoles(
    @Param('userId') userId: string,
    @Body() requestDto: AssignRolesRequestDto,
    @Request() req: JwtRequest,
  ) {
    const beforeUser = await this.getUserSnapshot(userId);
    const dto: AssignRolesDto = {
      userId,
      roleIds: requestDto.roleIds,
    };
    const result = await this.assignRolesUseCase.execute(dto);
    await this.auditLogService.record({
      domain: 'rbac',
      action: 'user.assign-roles',
      summary: `사용자 ${userId}의 역할을 변경했습니다.`,
      actorId: req.user?.id ?? req.user?.sub ?? null,
      actorEmail: req.user?.email ?? null,
      targetType: 'user',
      targetId: userId,
      metadata: {
        before: beforeUser,
        after: this.toUserSnapshot(result),
      },
    });
    return result;
  }

  // ==================== Terminal Limit Endpoints ====================

  /**
   * Reset terminal command count to 0
   */
  @Post('users/:id/reset-terminal-limit')
  @RequirePermissions(PERMISSIONS.RBAC_MANAGE)
  async resetTerminalLimit(@Param('id') id: string, @Request() req: JwtRequest) {
    const beforeUser = await this.getUserSnapshot(id);
    const result = await this.manageTerminalLimitUseCase.resetCommandCount(id);
    await this.auditLogService.record({
      domain: 'rbac',
      action: 'user.reset-terminal-limit',
      summary: `사용자 ${id}의 터미널 카운트를 초기화했습니다.`,
      actorId: req.user?.id ?? req.user?.sub ?? null,
      actorEmail: req.user?.email ?? null,
      targetType: 'user',
      targetId: id,
      metadata: {
        before: beforeUser,
        after: beforeUser
          ? {
              ...beforeUser,
              terminalCommandCount: result.terminalCommandCount,
            }
          : {
              terminalCommandCount: result.terminalCommandCount,
              terminalCommandLimit: result.terminalCommandLimit,
            },
      },
    });
    return result;
  }

  /**
   * Set terminal command limit
   */
  @Put('users/:id/terminal-limit')
  @RequirePermissions(PERMISSIONS.RBAC_MANAGE)
  async setTerminalLimit(
    @Param('id') id: string,
    @Body() requestDto: SetTerminalLimitRequestDto,
    @Request() req: JwtRequest,
  ) {
    const beforeUser = await this.getUserSnapshot(id);
    const result = await this.manageTerminalLimitUseCase.setCommandLimit(
      id,
      requestDto.limit,
    );
    await this.auditLogService.record({
      domain: 'rbac',
      action: 'user.set-terminal-limit',
      summary: `사용자 ${id}의 터미널 제한을 ${requestDto.limit}로 변경했습니다.`,
      actorId: req.user?.id ?? req.user?.sub ?? null,
      actorEmail: req.user?.email ?? null,
      targetType: 'user',
      targetId: id,
      metadata: {
        before: beforeUser,
        after: beforeUser
          ? {
              ...beforeUser,
              terminalCommandLimit: result.terminalCommandLimit,
            }
          : {
              terminalCommandLimit: result.terminalCommandLimit,
            },
      },
    });
    return result;
  }

  private async getUserSnapshot(id: string) {
    const users = await this.listUsersUseCase.execute();
    return this.toUserSnapshot(users.find((user) => user.id === id));
  }

  private toUserSnapshot(
    user:
      | {
          id: string;
          email: string;
          roles?: Array<{ name: string }>;
          terminalCommandCount: number;
          terminalCommandLimit: number;
        }
      | undefined,
  ) {
    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      roles: (user.roles ?? []).map((role) => role.name),
      terminalCommandCount: user.terminalCommandCount,
      terminalCommandLimit: user.terminalCommandLimit,
    };
  }
}
