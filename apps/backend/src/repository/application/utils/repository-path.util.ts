import { BadRequestException } from '@nestjs/common';
import * as path from 'path';
import { hasControlCharacter } from '../../../common/utils';
import { isReservedRepositoryPath } from '../../domain/policies/repository-path.policy';
export function assertSafeRepositoryPath(relativePath: string): void {
  if (
    !relativePath ||
    relativePath.includes('\0') ||
    relativePath.includes('\\') ||
    relativePath.length > 4096 ||
    hasControlCharacter(relativePath) ||
    path.posix.isAbsolute(relativePath) ||
    path.win32.isAbsolute(relativePath)
  ) {
    throw new BadRequestException(`안전하지 않은 경로: ${relativePath}`);
  }

  const normalized = path.posix.normalize(relativePath);
  const segments = normalized.split('/');
  if (
    normalized !== relativePath ||
    segments.some(
      (segment) =>
        !segment || segment === '.' || segment === '..' || segment.length > 255,
    ) ||
    isReservedRepositoryPath(normalized) ||
    normalized.startsWith('/')
  ) {
    throw new BadRequestException(`안전하지 않은 경로: ${relativePath}`);
  }
}
