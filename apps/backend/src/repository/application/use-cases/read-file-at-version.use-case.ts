import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  IProjectRepository,
  PROJECT_REPOSITORY,
} from '../../domain/repositories/project.repository.interface';
import {
  FILE_STORAGE,
  IFileStorage,
} from '../../domain/repositories/file-storage.interface';
import type { FileContentResult } from './read-file.use-case';

const MAX_PREVIEW_BYTES = 512 * 1024;

@Injectable()
export class ReadFileAtVersionUseCase {
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projectRepository: IProjectRepository,
    @Inject(FILE_STORAGE)
    private readonly fileStorage: IFileStorage,
  ) {}

  async execute(
    projectId: string,
    versionId: string,
    relativePath: string,
  ): Promise<FileContentResult & { found: boolean }> {
    const project = await this.projectRepository.findById(projectId);
    if (!project) {
      throw new NotFoundException(`프로젝트를 찾을 수 없습니다: ${projectId}`);
    }
    if (!relativePath || relativePath.includes('..')) {
      throw new BadRequestException('잘못된 경로');
    }
    if (!versionId) {
      throw new BadRequestException('versionId가 필요합니다');
    }

    const buffer = await this.fileStorage.readFileAtVersion(
      project.name,
      versionId,
      relativePath,
    );

    if (!buffer) {
      return {
        path: relativePath,
        size: 0,
        encoding: 'utf8',
        content: '',
        truncated: false,
        found: false,
      };
    }

    const probe = buffer.subarray(0, Math.min(8192, buffer.length));
    const hasNull = probe.includes(0);

    if (hasNull) {
      return {
        path: relativePath,
        size: buffer.length,
        encoding: 'base64',
        content: '',
        truncated: true,
        found: true,
      };
    }

    const truncated = buffer.length > MAX_PREVIEW_BYTES;
    const slice = truncated ? buffer.subarray(0, MAX_PREVIEW_BYTES) : buffer;
    return {
      path: relativePath,
      size: buffer.length,
      encoding: 'utf8',
      content: slice.toString('utf8'),
      truncated,
      found: true,
    };
  }
}
