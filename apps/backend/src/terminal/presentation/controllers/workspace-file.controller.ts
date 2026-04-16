import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RequirePermissions } from '../../../common/decorators';
import { PermissionsGuard } from '../../../common/guards';
import { PERMISSIONS } from '../../../common/constants/permissions';
import { WorkspaceFileService } from '../../application/services/workspace-file.service';

@Controller('terminal')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class WorkspaceFileController {
  constructor(private readonly workspaceFileService: WorkspaceFileService) {}

  @Get('workspace-file')
  @RequirePermissions(PERMISSIONS.TERMINAL_ACCESS)
  async readFile(@Query('path') filePath: string) {
    return this.workspaceFileService.readFile(filePath);
  }

  @Put('workspace-file')
  @RequirePermissions(PERMISSIONS.TERMINAL_ACCESS)
  async writeFile(
    @Body()
    body: {
      path: string;
      content: string;
    },
  ) {
    return this.workspaceFileService.writeFile(body.path, body.content ?? '');
  }

  @Get('workspace-tree')
  @RequirePermissions(PERMISSIONS.TERMINAL_ACCESS)
  async readTree() {
    return this.workspaceFileService.readTree();
  }

  @Get('workspace-diff')
  @RequirePermissions(PERMISSIONS.TERMINAL_ACCESS)
  async readDiff(@Query('path') filePath: string) {
    return this.workspaceFileService.readDiff(filePath);
  }

  @Post('workspace-diff/accept')
  @RequirePermissions(PERMISSIONS.TERMINAL_ACCESS)
  async acceptDiff(@Body() body: { path: string }) {
    return this.workspaceFileService.acceptDiff(body.path);
  }

  @Post('workspace-diff/reject')
  @RequirePermissions(PERMISSIONS.TERMINAL_ACCESS)
  async rejectDiff(@Body() body: { path: string }) {
    return this.workspaceFileService.rejectDiff(body.path);
  }

  @Post('workspace-diff/hunk/accept')
  @RequirePermissions(PERMISSIONS.TERMINAL_ACCESS)
  async acceptDiffHunk(@Body() body: { path: string; hunkIndex: number }) {
    return this.workspaceFileService.acceptDiffHunk(
      body.path,
      Number(body.hunkIndex ?? -1),
    );
  }

  @Post('workspace-diff/hunk/reject')
  @RequirePermissions(PERMISSIONS.TERMINAL_ACCESS)
  async rejectDiffHunk(@Body() body: { path: string; hunkIndex: number }) {
    return this.workspaceFileService.rejectDiffHunk(
      body.path,
      Number(body.hunkIndex ?? -1),
    );
  }

  @Post('workspace-commit')
  @RequirePermissions(PERMISSIONS.TERMINAL_ACCESS)
  async commitChanges(@Body() body: { message: string }) {
    return this.workspaceFileService.commitChanges(body.message ?? '');
  }

  @Post('workspace-branch')
  @RequirePermissions(PERMISSIONS.TERMINAL_ACCESS)
  async createBranch(@Body() body: { name: string }) {
    return this.workspaceFileService.createBranch(body.name ?? '');
  }

  @Post('workspace-push')
  @RequirePermissions(PERMISSIONS.TERMINAL_ACCESS)
  async pushBranch() {
    return this.workspaceFileService.pushBranch();
  }
}
