import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  IProjectRepository,
  PROJECT_REPOSITORY,
} from '../../domain/repositories/project.repository.interface';
import {
  FILE_STORAGE,
  IFileStorage,
} from '../../domain/repositories/file-storage.interface';
import { assertSafeRepositoryPath } from '../utils/repository-path.util';

export interface FileContentResult {
  path: string;
  size: number;
  encoding: 'utf8' | 'base64';
  content: string;
  truncated: boolean;
}

const MAX_PREVIEW_BYTES = 512 * 1024; // 512KB 미리보기 한도
const TEXT_EXTENSIONS = new Set([
  'txt',
  'md',
  'rst',
  'json',
  'yml',
  'yaml',
  'toml',
  'ini',
  'conf',
  'cfg',
  'xml',
  'html',
  'htm',
  'css',
  'scss',
  'sass',
  'less',
  'styl',
  'js',
  'jsx',
  'ts',
  'tsx',
  'mjs',
  'cjs',
  'vue',
  'svelte',
  'py',
  'pyi',
  'rb',
  'php',
  'java',
  'kt',
  'kts',
  'scala',
  'groovy',
  'c',
  'cpp',
  'cc',
  'h',
  'hpp',
  'cs',
  'go',
  'rs',
  'swift',
  'sh',
  'bash',
  'zsh',
  'fish',
  'ps1',
  'bat',
  'cmd',
  'sql',
  'graphql',
  'gql',
  'proto',
  'thrift',
  'lua',
  'r',
  'jl',
  'ex',
  'exs',
  'erl',
  'hs',
  'ml',
  'fs',
  'dart',
  'nim',
  'zig',
  'v',
  'clj',
  'el',
  'svg',
  'env',
  'gitignore',
  'editorconfig',
  'dockerfile',
  'makefile',
  'properties',
  'csv',
  'tsv',
]);

@Injectable()
export class ReadFileUseCase {
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projectRepository: IProjectRepository,
    @Inject(FILE_STORAGE)
    private readonly fileStorage: IFileStorage,
  ) {}

  async execute(
    projectId: string,
    relativePath: string,
    ownerId?: string,
  ): Promise<FileContentResult> {
    const project = await this.projectRepository.findById(projectId, ownerId);
    if (!project) {
      throw new NotFoundException(`프로젝트를 찾을 수 없습니다: ${projectId}`);
    }
    assertSafeRepositoryPath(relativePath);

    let buffer: Buffer;
    try {
      buffer = await this.fileStorage.readFile(project.name, relativePath);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        throw new NotFoundException(`파일을 찾을 수 없습니다: ${relativePath}`);
      }
      throw err;
    }

    // 텍스트 판별: 확장자 + 첫 8KB 안에 NULL 바이트가 있으면 바이너리
    const fileName = relativePath.split('/').pop() ?? '';
    const dotIdx = fileName.lastIndexOf('.');
    const ext =
      dotIdx > 0
        ? fileName.slice(dotIdx + 1).toLowerCase()
        : fileName.toLowerCase();
    const isTextByExt = TEXT_EXTENSIONS.has(ext);
    const probe = buffer.subarray(0, Math.min(8192, buffer.length));
    const hasNull = probe.includes(0);
    const isText = isTextByExt && !hasNull;

    if (isText) {
      const truncated = buffer.length > MAX_PREVIEW_BYTES;
      const slice = truncated ? buffer.subarray(0, MAX_PREVIEW_BYTES) : buffer;
      return {
        path: relativePath,
        size: buffer.length,
        encoding: 'utf8',
        content: slice.toString('utf8'),
        truncated,
      };
    }

    // 바이너리 — base64로 짧게 (미리보기 불가 표시용)
    return {
      path: relativePath,
      size: buffer.length,
      encoding: 'base64',
      content: '',
      truncated: true,
    };
  }
}
