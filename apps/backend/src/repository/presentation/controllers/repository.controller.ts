import {
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
import { PERMISSIONS } from '../../../common/constants/permissions';
import type { JwtRequest } from '../../../common/types/jwt-request.type';
import { AuditLogService } from '../../../audit/application/services/audit-log.service';
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
    private readonly auditLogService: AuditLogService,
  ) {}

  @Get('projects')
  @RequirePermissions(PERMISSIONS.REPOSITORY_READ)
  async listProjects() {
    const items = await this.listProjectsUseCase.execute();
    return { items };
  }

  @Post('projects')
  @RequirePermissions(PERMISSIONS.REPOSITORY_WRITE)
  async createProject(@Body() dto: CreateProjectDto, @Request() req: JwtRequest) {
    const project = await this.createProjectUseCase.execute(dto, req.user?.sub ?? null);
    await this.auditLogService.record({
      domain: 'repository',
      action: 'project.create',
      summary: `프로젝트 ${project.name}를 생성했습니다.`,
      actorId: req.user?.id ?? req.user?.sub ?? null,
      actorEmail: req.user?.email ?? null,
      targetType: 'project',
      targetId: project.id,
      metadata: {
        name: project.name,
        description: project.description ?? null,
      },
    });
    return project;
  }

  @Delete('projects/:id')
  @RequirePermissions(PERMISSIONS.REPOSITORY_DELETE)
  async deleteProject(@Param('id') id: string, @Request() req: JwtRequest) {
    await this.deleteProjectUseCase.execute(id);
    await this.auditLogService.record({
      domain: 'repository',
      action: 'project.delete',
      summary: `프로젝트 ${id}를 삭제했습니다.`,
      actorId: req.user?.id ?? req.user?.sub ?? null,
      actorEmail: req.user?.email ?? null,
      targetType: 'project',
      targetId: id,
    });
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
    // 클라이언트가 파일과 같은 순서로 보낸 relativePath 배열
    const paths: string[] = Array.isArray(relativePathsRaw)
      ? relativePathsRaw
      : relativePathsRaw
        ? JSON.parse(relativePathsRaw)
        : [];

    const uploadFiles: UploadFile[] = files.map((f, idx) => ({
      relativePath: paths[idx] ?? f.originalname,
      buffer: f.buffer,
      size: f.size,
    }));

    return this.uploadFilesUseCase.execute(id, uploadFiles, replace === 'true');
  }

  @Post('projects/:id/upload-sessions')
  @RequirePermissions(PERMISSIONS.REPOSITORY_WRITE)
  async createUploadSession(
    @Param('id') id: string,
    @Body() body: CreateUploadSessionInput,
    @Request() req: JwtRequest,
  ) {
    const session = await this.createUploadSessionUseCase.execute(id, body);
    await this.auditLogService.record({
      domain: 'repository',
      action: 'upload.session.create',
      summary: `프로젝트 ${id} 업로드 세션을 시작했습니다.`,
      actorId: req.user?.id ?? req.user?.sub ?? null,
      actorEmail: req.user?.email ?? null,
      targetType: 'project',
      targetId: id,
      metadata: {
        sessionId: session.id,
        totalFiles: session.totalFiles,
        totalBytes: session.totalBytes,
        batchCount: session.batches.length,
      },
    });
    return session;
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
        fileSize: 50 * 1024 * 1024, // 파일 하나당 50MB (클라이언트 1MB 필터 보완)
        fieldSize: 10 * 1024 * 1024,
        files: 200,
        fields: 100,
      },
    }),
  )
  async uploadSessionBatch(
    @Param('id') id: string,
    @Param('sessionId') sessionId: string,
    @Param('batchIndex') batchIndexRaw: string,
    @UploadedFiles() files: MulterFile[],
    @Body('relativePaths') relativePathsRaw: string | string[],
    @Request() req: JwtRequest,
  ) {
    const batchIndex = parseInt(batchIndexRaw, 10);
    const paths: string[] = Array.isArray(relativePathsRaw)
      ? relativePathsRaw
      : relativePathsRaw
        ? JSON.parse(relativePathsRaw)
        : [];

    const uploadFiles = files.map((file, index) => ({
      relativePath: paths[index] ?? file.originalname,
      buffer: file.buffer,
      size: file.size,
    }));

    const result = await this.uploadSessionBatchUseCase.execute(
      id,
      sessionId,
      batchIndex,
      uploadFiles,
    );
    await this.auditLogService.record({
      domain: 'repository',
      action: 'upload.batch.complete',
      summary: `프로젝트 ${id} 업로드 배치 ${batchIndex + 1}을 반영했습니다.`,
      actorId: req.user?.id ?? req.user?.sub ?? null,
      actorEmail: req.user?.email ?? null,
      targetType: 'project',
      targetId: id,
      metadata: {
        sessionId,
        batchIndex,
        uploadedCount: result.uploadedCount,
        failedFiles: result.failedFiles.length,
        status: result.session.status,
      },
    });
    return result;
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
}
