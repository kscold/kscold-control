import { createHash } from 'node:crypto';
import type { RepositoryUploadBatchFile } from '../../domain/types/upload-session.type';

export const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/;
export const MANIFEST_DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/;

export function hashUploadBuffer(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export function buildUploadManifestDigest(
  files: RepositoryUploadBatchFile[],
): string {
  const hash = createHash('sha256');
  [...files]
    .sort((left, right) => comparePaths(left.relativePath, right.relativePath))
    .forEach((file) => {
      hash.update(`${file.relativePath}\0${file.size}\0${file.sha256}\n`);
    });
  return `sha256:${hash.digest('hex')}`;
}

function comparePaths(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
