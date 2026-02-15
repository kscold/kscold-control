import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../../common/guards';
import { RequirePermissions } from '../../../common/decorators';

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
  SetTerminalLimitDto,
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
  ) {}

  // ==================== Role Endpoints ====================

  /**
   * Get all roles with permissions
   */
  @Get('roles')
  @RequirePermissions('rbac:manage')
  async getRoles() {
    return this.listRolesUseCase.execute();
  }

  // ==================== User Endpoints ====================

  /**
   * Get all users with roles
   */
  @Get('users')
  @RequirePermissions('rbac:manage')
  async getUsersWithRoles() {
    return this.listUsersUseCase.execute();
  }

  /**
   * Create a new user
   */
  @Post('users')
  @RequirePermissions('rbac:manage')
  async createUser(@Body() dto: CreateUserDto) {
    return this.createUserUseCase.execute(dto);
  }

  /**
   * Update user information
   */
  @Put('users/:id')
  @RequirePermissions('rbac:manage')
  async updateUser(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.updateUserUseCase.execute(id, dto);
  }

  /**
   * Delete a user
   */
  @Delete('users/:id')
  @RequirePermissions('rbac:manage')
  async deleteUser(@Param('id') id: string) {
    return this.deleteUserUseCase.execute(id);
  }

  /**
   * Assign roles to a user
   */
  @Post('users/:userId/roles')
  @RequirePermissions('rbac:manage')
  async assignRoles(
    @Param('userId') userId: string,
    @Body() requestDto: AssignRolesRequestDto,
  ) {
    const dto: AssignRolesDto = {
      userId,
      roleIds: requestDto.roleIds,
    };
    return this.assignRolesUseCase.execute(dto);
  }

  // ==================== Terminal Limit Endpoints ====================

  /**
   * Reset terminal command count to 0
   */
  @Post('users/:id/reset-terminal-limit')
  @RequirePermissions('rbac:manage')
  async resetTerminalLimit(@Param('id') id: string) {
    return this.manageTerminalLimitUseCase.resetCommandCount(id);
  }

  /**
   * Set terminal command limit
   */
  @Put('users/:id/terminal-limit')
  @RequirePermissions('rbac:manage')
  async setTerminalLimit(
    @Param('id') id: string,
    @Body() requestDto: SetTerminalLimitRequestDto,
  ) {
    return this.manageTerminalLimitUseCase.setCommandLimit(
      id,
      requestDto.limit,
    );
  }
}
