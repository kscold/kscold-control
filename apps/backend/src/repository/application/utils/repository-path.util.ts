import { BadRequestException } from '@nestjs/common';
import * as path from 'path';
import { hasControlCharacter } from '../../../common/utils';
import {
  containsPrivateKeyMaterial,
  isReservedRepositoryPath,
  isSensitiveRepositoryPath,
} from '../../domain/policies/repository-path.policy';
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
    normalized.startsWith('/') ||
    isSensitiveRepositoryPath(normalized)
  ) {
    throw new BadRequestException(`안전하지 않은 경로: ${relativePath}`);
  }
}

export function assertNoPrivateKeyMaterial(
  relativePath: string,
  buffer: Buffer,
): void {
  const preview = buffer.subarray(0, 128 * 1024).toString('utf8');
  if (containsPrivateKeyMaterial(preview)) {
    throw new BadRequestException(
      `비공개 키 자료가 포함된 파일은 업로드할 수 없습니다: ${relativePath}`,
    );
  }
}
