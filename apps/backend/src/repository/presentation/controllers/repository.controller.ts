import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Request,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { PermissionsGuard } from '../../../common/guards';
import { RequirePermissions } from '../../../common/decorators';
import { Audit } from '../../../common/decorators/audit.decorator';
import { PERMISSIONS } from '../../../common/constants/permissions';
import type { JwtRequest } from '../../../common/types/jwt-request.type';
import {
  CreateProjectUseCase,
  ListProjectsUseCase,
  DeleteProjectUseCase,
  UploadFilesUseCase,
  CreateUploadSessionUseCase,
  GetUploadSessionUseCase,
  UploadSessionBatchUseCase,
  DownloadArchiveUseCase,
  BrowseTreeUseCase,
  ReadFileUseCase,
  ReadFileAtVersionUseCase,
  ListVersionsUseCase,
  CleanupVersionsUseCase,
} from '../../application/use-cases';
import { CreateProjectDto } from '../../application/dto/create-project.dto';
import type { UploadFile } from '../../application/use-cases/upload-files.use-case';
import type { CreateUploadSessionInput } from '../../application/use-cases/create-upload-session.use-case';

interface MulterFile {
  fieldname: string;
  originalname: string;
  buffer: Buffer;
  size: number;
}

function parseRelativePaths(raw: string | string[] | undefined): string[] {
  if (Array.isArray(raw)) return raw;
  if (!raw) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    throw new BadRequestException('relativePaths 값이 올바른 JSON 배열이 아닙니다.');
  }
}

@Controller('repository')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class RepositoryController {
  constructor(
    private readonly createProjectUseCase: CreateProjectUseCase,
    private readonly listProjectsUseCase: ListProjectsUseCase,
    private readonly deleteProjectUseCase: DeleteProjectUseCase,
    private readonly uploadFilesUseCase: UploadFilesUseCase,
    private readonly createUploadSessionUseCase: CreateUploadSessionUseCase,
    private readonly getUploadSessionUseCase: GetUploadSessionUseCase,
    private readonly uploadSessionBatchUseCase: UploadSessionBatchUseCase,
    private readonly downloadArchiveUseCase: DownloadArchiveUseCase,
    private readonly browseTreeUseCase: BrowseTreeUseCase,
    private readonly readFileUseCase: ReadFileUseCase,
    private readonly readFileAtVersionUseCase: ReadFileAtVersionUseCase,
    private readonly listVersionsUseCase: ListVersionsUseCase,
    private readonly cleanupVersionsUseCase: CleanupVersionsUseCase,
  ) {}

  @Get('projects')
  @RequirePermissions(PERMISSIONS.REPOSITORY_READ)
  async listProjects() {
    const items = await this.listProjectsUseCase.execute();
    return { items };
  }

  @Post('projects')
  @RequirePermissions(PERMISSIONS.REPOSITORY_WRITE)
  @Audit({
    domain: 'repository',
    action: 'project.create',
    summary: (ctx) => `프로젝트 ${(ctx.response as { name: string }).name}를 생성했습니다.`,
    targetType: 'project',
    targetId: (ctx) => (ctx.response as { id: string }).id,
    metadata: (ctx) => {
      const r = ctx.response as { name: string; description?: string | null };
      return { name: r.name, description: r.description ?? null };
    },
  })
  async createProject(@Body() dto: CreateProjectDto, @Request() req: JwtRequest) {
    return this.createProjectUseCase.execute(dto, req.user?.sub ?? null);
  }

  @Delete('projects/:id')
  @RequirePermissions(PERMISSIONS.REPOSITORY_DELETE)
  @Audit({
    domain: 'repository',
    action: 'project.delete',
    summary: (ctx) => `프로젝트 ${ctx.params.id}를 삭제했습니다.`,
    targetType: 'project',
    targetId: (ctx) => ctx.params.id,
  })
  async deleteProject(@Param('id') id: string) {
    await this.deleteProjectUseCase.execute(id);
    return { success: true };
  }

  @Post('projects/:id/upload')
  @RequirePermissions(PERMISSIONS.REPOSITORY_WRITE)
  @UseInterceptors(
    FilesInterceptor('files', 1000, {
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB per file
        fieldSize: 10 * 1024 * 1024,
        fields: 5000,
        files: 1000,
      },
    }),
  )
  async uploadFiles(
    @Param('id') id: string,
    @UploadedFiles() files: MulterFile[],
    @Body('relativePaths') relativePathsRaw: string | string[],
    @Query('replace') replace?: string,
  ) {
    const paths: string[] = parseRelativePaths(relativePathsRaw);

    const uploadFiles: UploadFile[] = files.map((f, idx) => ({
      relativePath: paths[idx] ?? f.originalname,
      buffer: f.buffer,
      size: f.size,
    }));

    return this.uploadFilesUseCase.execute(id, uploadFiles, replace === 'true');
  }

  @Post('projects/:id/upload-sessions')
  @RequirePermissions(PERMISSIONS.REPOSITORY_WRITE)
  @Audit({
    domain: 'repository',
    action: 'upload.session.create',
    summary: (ctx) => `프로젝트 ${ctx.params.id} 업로드 세션을 시작했습니다.`,
    targetType: 'project',
    targetId: (ctx) => ctx.params.id,
    metadata: (ctx) => {
      const r = ctx.response as {
        id: string;
        totalFiles: number;
        totalBytes: number;
        batches: unknown[];
      };
      return {
        sessionId: r.id,
        totalFiles: r.totalFiles,
        totalBytes: r.totalBytes,
        batchCount: r.batches.length,
      };
    },
  })
  async createUploadSession(
    @Param('id') id: string,
    @Body() body: CreateUploadSessionInput,
  ) {
    return this.createUploadSessionUseCase.execute(id, body);
  }

  @Get('projects/:id/upload-sessions/latest')
  @RequirePermissions(PERMISSIONS.REPOSITORY_READ)
  async getLatestUploadSession(@Param('id') id: string) {
    const item = await this.getUploadSessionUseCase.executeLatest(id);
    return { item };
  }

  @Get('projects/:id/upload-sessions/:sessionId')
  @RequirePermissions(PERMISSIONS.REPOSITORY_READ)
  async getUploadSession(
    @Param('id') id: string,
    @Param('sessionId') sessionId: string,
  ) {
    const item = await this.getUploadSessionUseCase.executeById(id, sessionId);
    return { item };
  }

  @Post('projects/:id/upload-sessions/:sessionId/batches/:batchIndex')
  @RequirePermissions(PERMISSIONS.REPOSITORY_WRITE)
  @UseInterceptors(
    FilesInterceptor('files', 200, {
      limits: {
        fileSize: 50 * 1024 * 1024,
        fieldSize: 10 * 1024 * 1024,
        files: 200,
        fields: 100,
      },
    }),
  )
  @Audit({
    domain: 'repository',
    action: 'upload.batch.complete',
    summary: (ctx) =>
      `프로젝트 ${ctx.params.id} 업로드 배치 ${parseInt(ctx.params.batchIndex, 10) + 1}을 반영했습니다.`,
    targetType: 'project',
    targetId: (ctx) => ctx.params.id,
    metadata: (ctx) => {
      const r = ctx.response as {
        uploadedCount: number;
        failedFiles: unknown[];
        session: { status: string };
      };
      return {
        sessionId: ctx.params.sessionId,
        batchIndex: parseInt(ctx.params.batchIndex, 10),
        uploadedCount: r.uploadedCount,
        failedFiles: r.failedFiles.length,
        status: r.session.status,
      };
    },
  })
  async uploadSessionBatch(
    @Param('id') id: string,
    @Param('sessionId') sessionId: string,
    @Param('batchIndex') batchIndexRaw: string,
    @UploadedFiles() files: MulterFile[],
    @Body('relativePaths') relativePathsRaw: string | string[],
  ) {
    const batchIndex = parseInt(batchIndexRaw, 10);
    const paths: string[] = parseRelativePaths(relativePathsRaw);

    const uploadFiles = files.map((file, index) => ({
      relativePath: paths[index] ?? file.originalname,
      buffer: file.buffer,
      size: file.size,
    }));

    return this.uploadSessionBatchUseCase.execute(id, sessionId, batchIndex, uploadFiles);
  }

  @Get('projects/:id/download')
  @RequirePermissions(PERMISSIONS.REPOSITORY_READ)
  async downloadArchive(@Param('id') id: string, @Res() res: Response) {
    const { filename, stream } = await this.downloadArchiveUseCase.execute(id);
    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    stream.pipe(res);
  }

  @Get('projects/:id/tree')
  @RequirePermissions(PERMISSIONS.REPOSITORY_READ)
  async browseTree(@Param('id') id: string) {
    return this.browseTreeUseCase.execute(id);
  }

  @Get('projects/:id/file')
  @RequirePermissions(PERMISSIONS.REPOSITORY_READ)
  async readFile(@Param('id') id: string, @Query('path') path: string) {
    return this.readFileUseCase.execute(id, path);
  }

  @Get('projects/:id/file-at-version')
  @RequirePermissions(PERMISSIONS.REPOSITORY_READ)
  async readFileAtVersion(
    @Param('id') id: string,
    @Query('path') path: string,
    @Query('versionId') versionId: string,
  ) {
    return this.readFileAtVersionUseCase.execute(id, versionId, path);
  }

  @Get('projects/:id/versions')
  @RequirePermissions(PERMISSIONS.REPOSITORY_READ)
  async listVersions(@Param('id') id: string) {
    const versions = await this.listVersionsUseCase.execute(id);
    return { items: versions };
  }

  @Delete('projects/:id/versions/cleanup')
  @RequirePermissions(PERMISSIONS.REPOSITORY_DELETE)
  @Audit({
    domain: 'repository',
    action: 'versions.cleanup',
    summary: (ctx) => {
      const r = ctx.response as { projectName: string; deleted: number };
      return `프로젝트 ${r.projectName} 이전 버전 ${r.deleted}개를 삭제했습니다.`;
    },
    targetType: 'project',
    targetId: (ctx) => ctx.params.id,
    metadata: (ctx) => ({ deleted: (ctx.response as { deleted: number }).deleted }),
  })
  async cleanupVersions(@Param('id') id: string) {
    const { projectName, deleted } = await this.cleanupVersionsUseCase.execute(id, 1);
    // projectName 을 응답에 포함시켜 @Audit summary 팩토리에서 사용
    return { projectName, deleted };
  }
}
