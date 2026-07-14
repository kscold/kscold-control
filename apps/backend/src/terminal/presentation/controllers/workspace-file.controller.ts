import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  WorkspaceBranchDto,
  WorkspaceCommitDto,
  WorkspaceHunkDto,
  WorkspacePathDto,
} from '../dto/workspace-file.request.dto';
import { AuthGuard } from '@nestjs/passport';
import { RequirePermissions } from '../../../common/decorators';
import { PermissionsGuard } from '../../../common/guards';
import { PERMISSIONS } from '../../../common/constants/permissions';
import {
  AcceptWorkspaceDiffHunkUseCase,
  AcceptWorkspaceDiffUseCase,
  CommitWorkspaceChangesUseCase,
  CreateWorkspaceBranchUseCase,
  PushWorkspaceBranchUseCase,
  ReadWorkspaceDiffUseCase,
  ReadWorkspaceFileUseCase,
  ReadWorkspaceTreeUseCase,
  RejectWorkspaceDiffHunkUseCase,
  RejectWorkspaceDiffUseCase,
  WriteWorkspaceFileUseCase,
} from '../../application/use-cases';

@Controller('terminal')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class WorkspaceFileController {
  constructor(
    private readonly readWorkspaceFileUseCase: ReadWorkspaceFileUseCase,
    private readonly writeWorkspaceFileUseCase: WriteWorkspaceFileUseCase,
    private readonly readWorkspaceTreeUseCase: ReadWorkspaceTreeUseCase,
    private readonly readWorkspaceDiffUseCase: ReadWorkspaceDiffUseCase,
    private readonly acceptWorkspaceDiffUseCase: AcceptWorkspaceDiffUseCase,
    private readonly rejectWorkspaceDiffUseCase: RejectWorkspaceDiffUseCase,
    private readonly acceptWorkspaceDiffHunkUseCase: AcceptWorkspaceDiffHunkUseCase,
    private readonly rejectWorkspaceDiffHunkUseCase: RejectWorkspaceDiffHunkUseCase,
    private readonly commitWorkspaceChangesUseCase: CommitWorkspaceChangesUseCase,
    private readonly createWorkspaceBranchUseCase: CreateWorkspaceBranchUseCase,
    private readonly pushWorkspaceBranchUseCase: PushWorkspaceBranchUseCase,
  ) {}

  @Get('workspace-file')
  @RequirePermissions(PERMISSIONS.TERMINAL_ACCESS)
  async readFile(@Query('path') filePath: string) {
    return this.readWorkspaceFileUseCase.execute(filePath);
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
    return this.writeWorkspaceFileUseCase.execute(
      body.path,
      body.content ?? '',
    );
  }

  @Get('workspace-tree')
  @RequirePermissions(PERMISSIONS.TERMINAL_ACCESS)
  async readTree() {
    return this.readWorkspaceTreeUseCase.execute();
  }

  @Get('workspace-diff')
  @RequirePermissions(PERMISSIONS.TERMINAL_ACCESS)
  async readDiff(@Query('path') filePath: string) {
    return this.readWorkspaceDiffUseCase.execute(filePath);
  }

  @Post('workspace-diff/accept')
  @RequirePermissions(PERMISSIONS.TERMINAL_ACCESS)
  async acceptDiff(@Body() body: WorkspacePathDto) {
    return this.acceptWorkspaceDiffUseCase.execute(body.path);
  }

  @Post('workspace-diff/reject')
  @RequirePermissions(PERMISSIONS.TERMINAL_ACCESS)
  async rejectDiff(@Body() body: WorkspacePathDto) {
    return this.rejectWorkspaceDiffUseCase.execute(body.path);
  }

  @Post('workspace-diff/hunk/accept')
  @RequirePermissions(PERMISSIONS.TERMINAL_ACCESS)
  async acceptDiffHunk(@Body() body: WorkspaceHunkDto) {
    return this.acceptWorkspaceDiffHunkUseCase.execute(
      body.path,
      Number(body.hunkIndex ?? -1),
    );
  }

  @Post('workspace-diff/hunk/reject')
  @RequirePermissions(PERMISSIONS.TERMINAL_ACCESS)
  async rejectDiffHunk(@Body() body: WorkspaceHunkDto) {
    return this.rejectWorkspaceDiffHunkUseCase.execute(
      body.path,
      Number(body.hunkIndex ?? -1),
    );
  }

  @Post('workspace-commit')
  @RequirePermissions(PERMISSIONS.TERMINAL_ACCESS)
  async commitChanges(@Body() body: WorkspaceCommitDto) {
    return this.commitWorkspaceChangesUseCase.execute(body.message ?? '');
  }

  @Post('workspace-branch')
  @RequirePermissions(PERMISSIONS.TERMINAL_ACCESS)
  async createBranch(@Body() body: WorkspaceBranchDto) {
    return this.createWorkspaceBranchUseCase.execute(body.name ?? '');
  }

  @Post('workspace-push')
  @RequirePermissions(PERMISSIONS.TERMINAL_ACCESS)
  async pushBranch() {
    return this.pushWorkspaceBranchUseCase.execute();
  }
}
