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
import {
  CreateProjectUseCase,
  ListProjectsUseCase,
  DeleteProjectUseCase,
  UploadFilesUseCase,
  DownloadArchiveUseCase,
  BrowseTreeUseCase,
  ReadFileUseCase,
} from '../../application/use-cases';
import { CreateProjectDto } from '../../application/dto/create-project.dto';
import type { UploadFile } from '../../application/use-cases/upload-files.use-case';

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
    private readonly downloadArchiveUseCase: DownloadArchiveUseCase,
    private readonly browseTreeUseCase: BrowseTreeUseCase,
    private readonly readFileUseCase: ReadFileUseCase,
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
    return this.createProjectUseCase.execute(dto, req.user?.sub ?? null);
  }

  @Delete('projects/:id')
  @RequirePermissions(PERMISSIONS.REPOSITORY_DELETE)
  async deleteProject(@Param('id') id: string) {
    await this.deleteProjectUseCase.execute(id);
    return { success: true };
  }

  @Post('projects/:id/upload')
  @RequirePermissions(PERMISSIONS.REPOSITORY_WRITE)
  @UseInterceptors(
    FilesInterceptor('files', 1000, {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB per file (코드/설정 파일 기준)
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
