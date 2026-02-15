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
import { RbacService } from './rbac.service';
import { PermissionsGuard } from '../common/guards';
import { RequirePermissions } from '../common/decorators';

@Controller('rbac')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class RbacController {
  constructor(private rbacService: RbacService) {}

  // 역할 목록 조회
  @Get('roles')
  @RequirePermissions('rbac:manage')
  async getRoles() {
    return this.rbacService.getAllRoles();
  }

  // 역할 생성
  @Post('roles')
  @RequirePermissions('rbac:manage')
  async createRole(
    @Body()
    body: {
      name: string;
      description?: string;
      permissionIds: string[];
    },
  ) {
    return this.rbacService.createRole(
      body.name,
      body.description,
      body.permissionIds,
    );
  }

  // 역할 수정
  @Put('roles/:id')
  @RequirePermissions('rbac:manage')
  async updateRole(
    @Param('id') id: string,
    @Body()
    body: { name?: string; description?: string; permissionIds?: string[] },
  ) {
    return this.rbacService.updateRole(id, body);
  }

  // 역할 삭제
  @Delete('roles/:id')
  @RequirePermissions('rbac:manage')
  async deleteRole(@Param('id') id: string) {
    return this.rbacService.deleteRole(id);
  }

  // 권한 목록 조회
  @Get('permissions')
  @RequirePermissions('rbac:manage')
  async getPermissions() {
    return this.rbacService.getAllPermissions();
  }

  // 사용자 역할 할당
  @Post('users/:userId/roles')
  @RequirePermissions('rbac:manage')
  async assignRoles(
    @Param('userId') userId: string,
    @Body() body: { roleIds: string[] },
  ) {
    return this.rbacService.assignRolesToUser(userId, body.roleIds);
  }

  // 모든 사용자와 역할 조회
  @Get('users')
  @RequirePermissions('rbac:manage')
  async getUsersWithRoles() {
    return this.rbacService.getAllUsersWithRoles();
  }

  // 사용자 생성
  @Post('users')
  @RequirePermissions('rbac:manage')
  async createUser(
    @Body() body: { email: string; password: string; roleIds?: string[] },
  ) {
    return this.rbacService.createUser(body.email, body.password, body.roleIds);
  }

  // 사용자 수정 (비밀번호 변경)
  @Put('users/:id')
  @RequirePermissions('rbac:manage')
  async updateUser(
    @Param('id') id: string,
    @Body() body: { email?: string; password?: string },
  ) {
    return this.rbacService.updateUser(id, body);
  }

  // 사용자 삭제
  @Delete('users/:id')
  @RequirePermissions('rbac:manage')
  async deleteUser(@Param('id') id: string) {
    return this.rbacService.deleteUser(id);
  }

  // 터미널 명령어 제한 리셋
  @Post('users/:id/reset-terminal-limit')
  @RequirePermissions('rbac:manage')
  async resetTerminalLimit(@Param('id') id: string) {
    return this.rbacService.resetTerminalCommandCount(id);
  }

  // 터미널 명령어 제한 설정
  @Put('users/:id/terminal-limit')
  @RequirePermissions('rbac:manage')
  async setTerminalLimit(
    @Param('id') id: string,
    @Body() body: { limit: number },
  ) {
    return this.rbacService.setTerminalCommandLimit(id, body.limit);
  }
}
