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
import { Audit } from '../../../common/decorators/audit.decorator';
import { PERMISSIONS } from '../../../common/constants/permissions';
import type { JwtRequest } from '../../../common/types/jwt-request.type';

// Application Layer
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
} from '../../application/use-cases';
import {
  CreateUserDto,
  UpdateUserDto,
  AssignRolesDto,
} from '../../application/dto';

// Presentation Layer
import { AssignRolesRequestDto, SetTerminalLimitRequestDto } from '../dto';

/** 감사 로그용 사용자 스냅샷 — 모듈 레벨 순수 함수로 분리 (데코레이터 팩토리에서 공유) */
function toUserSnapshot(
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
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    roles: (user.roles ?? []).map((r) => r.name),
    terminalCommandCount: user.terminalCommandCount,
    terminalCommandLimit: user.terminalCommandLimit,
  };
}

/** req 에 주입하는 before 스냅샷 타입 */
interface RbacRequest extends JwtRequest {
  _auditExtra?: { before: ReturnType<typeof toUserSnapshot> };
}

/**
 * RBAC Controller
 * Presentation layer — handles HTTP concerns only.
 * Cross-cutting audit logging is handled via @Audit() + AuditInterceptor (AOP).
 *
 * before 스냅샷이 필요한 핸들러에서는 req._auditExtra = { before } 를 설정합니다.
 * AuditInterceptor 가 이를 ctx.extra 로 전달하므로 metadata 팩토리에서 접근 가능합니다.
 */
@Controller('rbac')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class RbacController {
  constructor(
    private readonly createUserUseCase: CreateUserUseCase,
    private readonly updateUserUseCase: UpdateUserUseCase,
    private readonly deleteUserUseCase: DeleteUserUseCase,
    private readonly listUsersUseCase: ListUsersUseCase,
    private readonly assignRolesUseCase: AssignRolesUseCase,
    private readonly listRolesUseCase: ListRolesUseCase,
    private readonly listPermissionsUseCase: ListPermissionsUseCase,
    private readonly manageTerminalLimitUseCase: ManageTerminalLimitUseCase,
    private readonly approveKeyManagerUseCase: ApproveKeyManagerUseCase,
  ) {}

  // ==================== Role Endpoints ====================

  @Get('roles')
  @RequirePermissions(PERMISSIONS.RBAC_MANAGE)
  async getRoles() {
    return this.listRolesUseCase.execute();
  }

  // ==================== Permission Endpoints ====================

  /** 역할에 부여할 수 있는 전체 권한 목록 (DB 기준) */
  @Get('permissions')
  @RequirePermissions(PERMISSIONS.RBAC_MANAGE)
  async getPermissions() {
    return this.listPermissionsUseCase.execute();
  }

  // ==================== User Endpoints ====================

  @Get('users')
  @RequirePermissions(PERMISSIONS.RBAC_MANAGE)
  async getUsersWithRoles() {
    return this.listUsersUseCase.execute();
  }

  @Post('users')
  @RequirePermissions(PERMISSIONS.RBAC_MANAGE)
  @Audit({
    domain: 'rbac',
    action: 'user.create',
    summary: (ctx) =>
      `사용자 ${(ctx.response as { email: string }).email}을 생성했습니다.`,
    targetType: 'user',
    targetId: (ctx) => (ctx.response as { id: string }).id,
    metadata: (ctx) => ({
      after: toUserSnapshot(
        ctx.response as Parameters<typeof toUserSnapshot>[0],
      ),
    }),
  })
  async createUser(@Body() dto: CreateUserDto) {
    return this.createUserUseCase.execute(dto);
  }

  @Put('users/:id')
  @RequirePermissions(PERMISSIONS.RBAC_MANAGE)
  @Audit({
    domain: 'rbac',
    action: 'user.update',
    summary: (ctx) => `사용자 ${ctx.params.id} 정보를 수정했습니다.`,
    targetType: 'user',
    targetId: (ctx) => ctx.params.id,
    metadata: (ctx) => ({
      before: (ctx.extra as { before?: unknown }).before ?? null,
      after: toUserSnapshot(
        ctx.response as Parameters<typeof toUserSnapshot>[0],
      ),
      passwordChanged: Boolean((ctx.body as { password?: string }).password),
    }),
  })
  async updateUser(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @Request() req: RbacRequest,
  ) {
    req._auditExtra = { before: await this.getUserSnapshot(id) };
    return this.updateUserUseCase.execute(id, dto);
  }

  @Delete('users/:id')
  @RequirePermissions(PERMISSIONS.RBAC_MANAGE)
  @Audit({
    domain: 'rbac',
    action: 'user.delete',
    summary: (ctx) => `사용자 ${ctx.params.id}를 삭제했습니다.`,
    targetType: 'user',
    targetId: (ctx) => ctx.params.id,
    metadata: (ctx) => ({
      before: (ctx.extra as { before?: unknown }).before ?? null,
    }),
  })
  async deleteUser(@Param('id') id: string, @Request() req: RbacRequest) {
    req._auditExtra = { before: await this.getUserSnapshot(id) };
    await this.deleteUserUseCase.execute(id);
    return { success: true };
  }

  @Post('users/:userId/roles')
  @RequirePermissions(PERMISSIONS.RBAC_MANAGE)
  @Audit({
    domain: 'rbac',
    action: 'user.assign-roles',
    summary: (ctx) => `사용자 ${ctx.params.userId}의 역할을 변경했습니다.`,
    targetType: 'user',
    targetId: (ctx) => ctx.params.userId,
    metadata: (ctx) => ({
      before: (ctx.extra as { before?: unknown }).before ?? null,
      after: toUserSnapshot(
        ctx.response as Parameters<typeof toUserSnapshot>[0],
      ),
    }),
  })
  async assignRoles(
    @Param('userId') userId: string,
    @Body() requestDto: AssignRolesRequestDto,
    @Request() req: RbacRequest,
  ) {
    req._auditExtra = { before: await this.getUserSnapshot(userId) };
    const dto: AssignRolesDto = { userId, roleIds: requestDto.roleIds };
    return this.assignRolesUseCase.execute(dto);
  }

  @Post('users/:id/approve-key-manager')
  @RequirePermissions(PERMISSIONS.RBAC_MANAGE)
  @Audit({
    domain: 'rbac',
    action: 'user.approve-key-manager',
    summary: (ctx) =>
      `사용자 ${ctx.params.id}의 GoLe 키 관리 접근을 승인했습니다.`,
    targetType: 'user',
    targetId: (ctx) => ctx.params.id,
    metadata: (ctx) => ({
      before: (ctx.extra as { before?: unknown }).before ?? null,
      after: toUserSnapshot(
        ctx.response as Parameters<typeof toUserSnapshot>[0],
      ),
    }),
  })
  async approveKeyManager(
    @Param('id') id: string,
    @Request() req: RbacRequest,
  ) {
    req._auditExtra = { before: await this.getUserSnapshot(id) };
    return this.approveKeyManagerUseCase.execute(id);
  }

  // ==================== Terminal Limit Endpoints ====================

  @Post('users/:id/reset-terminal-limit')
  @RequirePermissions(PERMISSIONS.RBAC_MANAGE)
  @Audit({
    domain: 'rbac',
    action: 'user.reset-terminal-limit',
    summary: (ctx) =>
      `사용자 ${ctx.params.id}의 터미널 카운트를 초기화했습니다.`,
    targetType: 'user',
    targetId: (ctx) => ctx.params.id,
    metadata: (ctx) => {
      const before = (ctx.extra as { before?: Record<string, unknown> | null })
        .before;
      const r = ctx.response as {
        terminalCommandCount: number;
        terminalCommandLimit: number;
      };
      return {
        before,
        after: before
          ? { ...before, terminalCommandCount: r.terminalCommandCount }
          : {
              terminalCommandCount: r.terminalCommandCount,
              terminalCommandLimit: r.terminalCommandLimit,
            },
      };
    },
  })
  async resetTerminalLimit(
    @Param('id') id: string,
    @Request() req: RbacRequest,
  ) {
    req._auditExtra = { before: await this.getUserSnapshot(id) };
    return this.manageTerminalLimitUseCase.resetCommandCount(id);
  }

  @Put('users/:id/terminal-limit')
  @RequirePermissions(PERMISSIONS.RBAC_MANAGE)
  @Audit({
    domain: 'rbac',
    action: 'user.set-terminal-limit',
    summary: (ctx) =>
      `사용자 ${ctx.params.id}의 터미널 제한을 ${(ctx.body as { limit: number }).limit}로 변경했습니다.`,
    targetType: 'user',
    targetId: (ctx) => ctx.params.id,
    metadata: (ctx) => {
      const before = (ctx.extra as { before?: Record<string, unknown> | null })
        .before;
      const r = ctx.response as { terminalCommandLimit: number };
      return {
        before,
        after: before
          ? { ...before, terminalCommandLimit: r.terminalCommandLimit }
          : { terminalCommandLimit: r.terminalCommandLimit },
      };
    },
  })
  async setTerminalLimit(
    @Param('id') id: string,
    @Body() requestDto: SetTerminalLimitRequestDto,
    @Request() req: RbacRequest,
  ) {
    req._auditExtra = { before: await this.getUserSnapshot(id) };
    return this.manageTerminalLimitUseCase.setCommandLimit(
      id,
      requestDto.limit,
    );
  }

  // ==================== Private helpers ====================

  private async getUserSnapshot(id: string) {
    const users = await this.listUsersUseCase.execute();
    return toUserSnapshot(users.find((user) => user.id === id));
  }
}
