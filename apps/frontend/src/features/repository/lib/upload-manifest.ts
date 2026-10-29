import type {
  ClientFile,
  RepositoryUploadBatchFileMeta,
} from '@/entities/project';
import { Sha256 } from '@/shared/lib';

export const REPOSITORY_UPLOAD_PROTOCOL_VERSION = 2;

/**
 * 이보다 큰 파일은 통째로 메모리에 올리지 않고 조각씩 읽어 해시한다.
 * 이런 파일은 선택 시점 복사본을 만들지 않고 원본을 그대로 조각 업로드하며,
 * 도중에 파일이 바뀌면 서버의 최종 해시 검사에서 걸러진다.
 */
export const STREAM_HASH_BYTES = 64 * 1024 * 1024;
const STREAM_READ_BYTES = 8 * 1024 * 1024;

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (value) =>
    value.toString(16).padStart(2, '0'),
  ).join('');
}

async function sha256(value: BufferSource): Promise<string> {
  const bytes = ArrayBuffer.isView(value)
    ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
    : new Uint8Array(value);

  return toHex(await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes)));
}

export interface HashedClientFile {
  clientFile: ClientFile;
  metadata: RepositoryUploadBatchFileMeta;
}

function freezeClientFile(
  clientFile: ClientFile,
  content: ArrayBuffer,
): ClientFile {
  const source = clientFile.file;
  return {
    relativePath: clientFile.relativePath,
    file: new File([content], source.name, {
      lastModified: source.lastModified,
      type: source.type,
    }),
  };
}

function isUnreadable(readError: unknown): boolean {
  return (
    readError instanceof DOMException &&
    ['NotFoundError', 'NotReadableError'].includes(readError.name)
  );
}

/** 선택 뒤에 바뀌거나 사라진 파일은 브라우저가 읽기를 거부한다 (NotFoundError/NotReadableError). */
async function readSelectedFile(file: File): Promise<ArrayBuffer | null> {
  try {
    return await file.arrayBuffer();
  } catch (readError) {
    if (isUnreadable(readError)) return null;
    throw readError;
  }
}

/** 큰 파일을 조각씩 읽어 해시한다. 읽을 수 없으면 null */
async function hashLargeFile(file: File): Promise<string | null> {
  const hash = new Sha256();
  try {
    for (let offset = 0; offset < file.size; offset += STREAM_READ_BYTES) {
      const piece = await file
        .slice(offset, offset + STREAM_READ_BYTES)
        .arrayBuffer();
      hash.update(new Uint8Array(piece));
    }
  } catch (readError) {
    if (isUnreadable(readError)) return null;
    throw readError;
  }
  return hash.digestHex();
}

/** 선택 시점 바이트를 고정하고, 같은 크기의 내용 변경도 구분하는 재개 토큰을 만든다.
 *  읽을 수 없는 파일은 전체를 멈추지 않고 건너뛴 뒤 unreadablePaths로 알린다. */
export async function buildUploadManifest(
  files: ClientFile[],
  onProgress?: (processed: number, total: number) => void,
  { streamHashBytes = STREAM_HASH_BYTES }: { streamHashBytes?: number } = {},
): Promise<{
  digest: string;
  files: HashedClientFile[];
  unreadablePaths: string[];
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
  const unreadablePaths: string[] = [];
  let processed = 0;

  for (const clientFile of sorted) {
    if (paths.has(clientFile.relativePath)) {
      throw new Error(`중복 파일 경로가 있습니다: ${clientFile.relativePath}`);
    }
    paths.add(clientFile.relativePath);
    if (clientFile.file.size > streamHashBytes) {
      const contentHash = await hashLargeFile(clientFile.file);
      processed++;
      if (contentHash === null) {
        unreadablePaths.push(clientFile.relativePath);
        continue;
      }
      const metadata = {
        relativePath: clientFile.relativePath,
        size: clientFile.file.size,
        sha256: contentHash,
      };
      hashedFiles.push({ clientFile, metadata });
      manifestParts.push(
        `${metadata.relativePath}\0${metadata.size}\0${metadata.sha256}\n`,
      );
      onProgress?.(processed, sorted.length);
      continue;
    }
    const content = await readSelectedFile(clientFile.file);
    processed++;
    if (content === null) {
      unreadablePaths.push(clientFile.relativePath);
      continue;
    }
    const frozenClientFile = freezeClientFile(clientFile, content);
    const contentHash = await sha256(content);
    const metadata = {
      relativePath: clientFile.relativePath,
      size: content.byteLength,
      sha256: contentHash,
    };
    hashedFiles.push({ clientFile: frozenClientFile, metadata });
    manifestParts.push(
      `${metadata.relativePath}\0${metadata.size}\0${metadata.sha256}\n`,
    );
    if (processed % 50 === 0 || processed === sorted.length) {
      onProgress?.(processed, sorted.length);
    }
  }

  const digest = await sha256(new TextEncoder().encode(manifestParts.join('')));
  return { digest: `sha256:${digest}`, files: hashedFiles, unreadablePaths };
}
