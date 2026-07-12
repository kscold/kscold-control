import { BadRequestException } from '@nestjs/common';
import * as path from 'path';

export function assertSafeRepositoryPath(relativePath: string): void {
  if (
    !relativePath ||
    relativePath.includes('\0') ||
    path.posix.isAbsolute(relativePath) ||
    path.win32.isAbsolute(relativePath)
  ) {
    throw new BadRequestException(`안전하지 않은 경로: ${relativePath}`);
  }

  const normalized = relativePath.replaceAll('\\', '/');
  const segments = normalized.split('/');
  if (segments.includes('..') || normalized.startsWith('/')) {
    throw new BadRequestException(`안전하지 않은 경로: ${relativePath}`);
  }
}
