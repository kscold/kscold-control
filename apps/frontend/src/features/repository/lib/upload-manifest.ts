import type {
  ClientFile,
  RepositoryUploadBatchFileMeta,
} from '@/entities/project';

export const REPOSITORY_UPLOAD_PROTOCOL_VERSION = 2;

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (value) =>
    value.toString(16).padStart(2, '0'),
  ).join('');
}

async function sha256(value: BufferSource): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', value));
}

export interface HashedClientFile {
  clientFile: ClientFile;
  metadata: RepositoryUploadBatchFileMeta;
}

/** 파일 내용까지 포함한 재개 토큰을 만들어 같은 크기의 변경도 구분한다. */
export async function buildUploadManifest(files: ClientFile[]): Promise<{
  digest: string;
  files: HashedClientFile[];
}> {
  const sorted = [...files].sort((left, right) =>
    left.relativePath < right.relativePath
      ? -1
      : left.relativePath > right.relativePath
        ? 1
        : 0,
  );
  const hashedFiles: HashedClientFile[] = [];
  const manifestParts: string[] = [];
  const paths = new Set<string>();

  for (const clientFile of sorted) {
    if (paths.has(clientFile.relativePath)) {
      throw new Error(`중복 파일 경로가 있습니다: ${clientFile.relativePath}`);
    }
    paths.add(clientFile.relativePath);
    const content = await clientFile.file.arrayBuffer();
    const contentHash = await sha256(content);
    const metadata = {
      relativePath: clientFile.relativePath,
      size: clientFile.file.size,
      sha256: contentHash,
    };
    hashedFiles.push({ clientFile, metadata });
    manifestParts.push(
      `${metadata.relativePath}\0${metadata.size}\0${metadata.sha256}\n`,
    );
  }

  const digest = await sha256(new TextEncoder().encode(manifestParts.join('')));
  return { digest: `sha256:${digest}`, files: hashedFiles };
}
