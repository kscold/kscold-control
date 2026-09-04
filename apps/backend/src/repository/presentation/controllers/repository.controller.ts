import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
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
import { isGlobalAdministrator } from '../../../common/utils';
import type { JwtRequest } from '../../../common/types/jwt-request.type';
import {
  CreateProjectUseCase,
  ListProjectsUseCase,
  DeleteProjectUseCase,
  UploadFilesUseCase,
  CreateUploadSessionUseCase,
  GetUploadSessionUseCase,
  UploadSessionBatchUseCase,
  FinalizeUploadSessionUseCase,
  DownloadArchiveUseCase,
  BrowseTreeUseCase,
  ReadFileUseCase,
  ReadFileAtVersionUseCase,
  ListVersionsUseCase,
  CleanupVersionsUseCase,
  RestoreVersionUseCase,
} from '../../application/use-cases';
import { CreateProjectDto } from '../../application/dto/create-project.dto';
import type { UploadFile } from '../../application/use-cases/upload-files.use-case';
import { CreateUploadSessionRequestDto } from '../dto';

interface MulterFile {
  fieldname: string;
  originalname: string;
  buffer: Buffer;
  size: number;
}

function parseRelativePaths(raw: string | string[] | undefined): string[] {
  if (Array.isArray(raw)) {
    if (raw.every((item) => typeof item === 'string')) return raw;
    throw new BadRequestException('relativePaths는 문자열 배열이어야 합니다.');
  }
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      !Array.isArray(parsed) ||
      !parsed.every((item) => typeof item === 'string')
    ) {
      throw new Error('not a string array');
    }
    return parsed;
  } catch {
    throw new BadRequestException(
      'relativePaths 값이 올바른 JSON 배열이 아닙니다.',
    );
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
    private readonly finalizeUploadSessionUseCase: FinalizeUploadSessionUseCase,
    private readonly downloadArchiveUseCase: DownloadArchiveUseCase,
    private readonly browseTreeUseCase: BrowseTreeUseCase,
    private readonly readFileUseCase: ReadFileUseCase,
    private readonly readFileAtVersionUseCase: ReadFileAtVersionUseCase,
    private readonly listVersionsUseCase: ListVersionsUseCase,
    private readonly cleanupVersionsUseCase: CleanupVersionsUseCase,
    private readonly restoreVersionUseCase: RestoreVersionUseCase,
  ) {}

  @Get('projects')
  @RequirePermissions(PERMISSIONS.REPOSITORY_READ)
  async listProjects(@Request() req: JwtRequest) {
    const items = await this.listProjectsUseCase.execute(
      getProjectOwnerScope(req),
    );
    return { items };
  }

  @Post('projects')
  @RequirePermissions(PERMISSIONS.REPOSITORY_WRITE)
  @Audit({
    domain: 'repository',
    action: 'project.create',
    summary: (ctx) =>
      `프로젝트 ${(ctx.response as { name: string }).name}를 생성했습니다.`,
    targetType: 'project',
    targetId: (ctx) => (ctx.response as { id: string }).id,
    metadata: (ctx) => {
      const r = ctx.response as { name: string; description?: string | null };
      return { name: r.name, description: r.description ?? null };
    },
  })
  async createProject(
    @Body() dto: CreateProjectDto,
    @Request() req: JwtRequest,
  ) {
    // HTTP 요청의 사용자 식별자는 id 다. sub 는 소켓 토큰에만 있어 여기서는 항상 비어 있었고,
    // 그 결과 생성된 프로젝트의 소유자가 저장되지 않아 비관리자가 자기 프로젝트를 볼 수 없었다.
    return this.createProjectUseCase.execute(dto, req.user?.id ?? null);
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
  async deleteProject(@Param('id') id: string, @Request() req: JwtRequest) {
    await this.deleteProjectUseCase.execute(id, getProjectOwnerScope(req));
    return { success: true };
  }

  @Post('projects/:id/upload')
  @RequirePermissions(PERMISSIONS.REPOSITORY_WRITE)
  @UseInterceptors(
    FilesInterceptor('files', 1000, {
      limits: {
        fileSize: 50 * 1024 * 1024, // 파일당 50MB
        fieldSize: 10 * 1024 * 1024,
        fields: 5000,
        files: 1000,
      },
    }),
  )
  @Audit({
    domain: 'repository',
    action: 'upload.legacy.complete',
    summary: (ctx) =>
      `프로젝트 ${ctx.params.id} 단일 요청 업로드를 반영했습니다.`,
    targetType: 'project',
    targetId: (ctx) => ctx.params.id,
    metadata: (ctx) => {
      const response = ctx.response as {
        uploadedCount: number;
        totalBytes: number;
      };
      return {
        uploadedCount: response.uploadedCount,
        totalBytes: response.totalBytes,
      };
    },
  })
  async uploadFiles(
    @Param('id') id: string,
    @UploadedFiles() files: MulterFile[],
    @Body('relativePaths') relativePathsRaw: string | string[],
    @Query('replace') replace: string | undefined,
    @Request() req: JwtRequest,
  ) {
    if (!files?.length) {
      throw new BadRequestException('업로드할 파일이 없습니다.');
    }
    const paths: string[] = parseRelativePaths(relativePathsRaw);
    if (paths.length !== files.length) {
      throw new BadRequestException(
        '업로드 파일 수와 relativePaths 수가 일치하지 않습니다.',
      );
    }

    const uploadFiles: UploadFile[] = files.map((f, idx) => ({
      relativePath: paths[idx],
      buffer: f.buffer,
      size: f.size,
    }));

    return this.uploadFilesUseCase.execute(
      id,
      uploadFiles,
      replace === 'true',
      getProjectOwnerScope(req),
    );
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
    @Body() body: CreateUploadSessionRequestDto,
    @Request() req: JwtRequest,
  ) {
    return this.createUploadSessionUseCase.execute(
      id,
      body,
      getProjectOwnerScope(req),
    );
  }

  @Get('projects/:id/upload-sessions/latest')
  @RequirePermissions(PERMISSIONS.REPOSITORY_READ)
  async getLatestUploadSession(
    @Param('id') id: string,
    @Request() req: JwtRequest,
  ) {
    const item = await this.getUploadSessionUseCase.executeLatest(
      id,
      getProjectOwnerScope(req),
    );
    return { item };
  }

  @Get('projects/:id/upload-sessions/:sessionId')
  @RequirePermissions(PERMISSIONS.REPOSITORY_READ)
  async getUploadSession(
    @Param('id') id: string,
    @Param('sessionId') sessionId: string,
    @Request() req: JwtRequest,
  ) {
    const item = await this.getUploadSessionUseCase.executeById(
      id,
      sessionId,
      getProjectOwnerScope(req),
    );
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
    @Param('batchIndex', ParseIntPipe) batchIndex: number,
    @UploadedFiles() files: MulterFile[],
    @Body('relativePaths') relativePathsRaw: string | string[],
    @Request() req: JwtRequest,
  ) {
    if (!files?.length) {
      throw new BadRequestException('업로드할 배치 파일이 없습니다.');
    }
    const paths: string[] = parseRelativePaths(relativePathsRaw);
    if (paths.length !== files.length) {
      throw new BadRequestException(
        '업로드 파일 수와 relativePaths 수가 일치하지 않습니다.',
      );
    }

    const uploadFiles = files.map((file, index) => ({
      relativePath: paths[index],
      buffer: file.buffer,
      size: file.size,
    }));

    return this.uploadSessionBatchUseCase.execute(
      id,
      sessionId,
      batchIndex,
      uploadFiles,
      getProjectOwnerScope(req),
    );
  }

  @Post('projects/:id/upload-sessions/:sessionId/finalize')
  @RequirePermissions(PERMISSIONS.REPOSITORY_WRITE)
  @Audit({
    domain: 'repository',
    action: 'upload.session.finalize',
    summary: (ctx) =>
      `프로젝트 ${ctx.params.id} 업로드를 검증하고 최종 반영했습니다.`,
    targetType: 'project',
    targetId: (ctx) => ctx.params.id,
    metadata: (ctx) => {
      const response = ctx.response as {
        session: { id: string; snapshotId: string | null; totalFiles: number };
      };
      return {
        sessionId: response.session.id,
        snapshotId: response.session.snapshotId,
        totalFiles: response.session.totalFiles,
      };
    },
  })
  async finalizeUploadSession(
    @Param('id') id: string,
    @Param('sessionId') sessionId: string,
    @Request() req: JwtRequest,
  ) {
    return this.finalizeUploadSessionUseCase.execute(
      id,
      sessionId,
      getProjectOwnerScope(req),
    );
  }

  @Get('projects/:id/download')
  @RequirePermissions(PERMISSIONS.REPOSITORY_READ)
  async downloadArchive(
    @Param('id') id: string,
    @Res() res: Response,
    @Request() req: JwtRequest,
  ) {
    const { filename, stream } = await this.downloadArchiveUseCase.execute(
      id,
      getProjectOwnerScope(req),
    );
    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    stream.pipe(res);
  }

  @Get('projects/:id/tree')
  @RequirePermissions(PERMISSIONS.REPOSITORY_READ)
  async browseTree(@Param('id') id: string, @Request() req: JwtRequest) {
    return this.browseTreeUseCase.execute(id, getProjectOwnerScope(req));
  }

  @Get('projects/:id/file')
  @RequirePermissions(PERMISSIONS.REPOSITORY_READ)
  async readFile(
    @Param('id') id: string,
    @Query('path') path: string,
    @Request() req: JwtRequest,
  ) {
    return this.readFileUseCase.execute(id, path, getProjectOwnerScope(req));
  }

  @Get('projects/:id/file-at-version')
  @RequirePermissions(PERMISSIONS.REPOSITORY_READ)
  async readFileAtVersion(
    @Param('id') id: string,
    @Query('path') path: string,
    @Query('versionId') versionId: string,
    @Request() req: JwtRequest,
  ) {
    return this.readFileAtVersionUseCase.execute(
      id,
      versionId,
      path,
      getProjectOwnerScope(req),
    );
  }

  @Get('projects/:id/versions')
  @RequirePermissions(PERMISSIONS.REPOSITORY_READ)
  async listVersions(@Param('id') id: string, @Request() req: JwtRequest) {
    const versions = await this.listVersionsUseCase.execute(
      id,
      getProjectOwnerScope(req),
    );
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
    metadata: (ctx) => ({
      deleted: (ctx.response as { deleted: number }).deleted,
    }),
  })
  async cleanupVersions(@Param('id') id: string, @Request() req: JwtRequest) {
    const { projectName, deleted } = await this.cleanupVersionsUseCase.execute(
      id,
      1,
      getProjectOwnerScope(req),
    );
    // projectName 을 응답에 포함시켜 @Audit summary 팩토리에서 사용
    return { projectName, deleted };
  }

  @Post('projects/:id/versions/:versionId/restore')
  @RequirePermissions(PERMISSIONS.REPOSITORY_WRITE)
  @Audit({
    domain: 'repository',
    action: 'versions.restore',
    summary: (ctx) =>
      `프로젝트를 버전 ${ctx.params.versionId}(으)로 복원했습니다.`,
    targetType: 'project',
    targetId: (ctx) => ctx.params.id,
    metadata: (ctx) => ({ versionId: ctx.params.versionId }),
  })
  async restoreVersion(
    @Param('id') id: string,
    @Param('versionId') versionId: string,
    @Request() req: JwtRequest,
  ) {
    return this.restoreVersionUseCase.execute(
      id,
      versionId,
      getProjectOwnerScope(req),
    );
  }
}

function getProjectOwnerScope(req: JwtRequest): string | undefined {
  return isGlobalAdministrator(req.user.roles) ? undefined : req.user.id;
}
