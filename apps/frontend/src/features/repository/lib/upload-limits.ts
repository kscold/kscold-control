import type { RepositoryUploadLimits } from '@/entities/project';
import { formatBytes } from '@/shared/lib';

export function assertUploadFilesWithinLimits(
  files: Array<{ relativePath: string; file: { size: number } }>,
  limits: RepositoryUploadLimits,
): void {
  // 파일 한도는 서버 정책을 그대로 쓴다. 서버가 정하지 않았으면 화면에서 따로 막지 않는다
  const maxFileBytes = limits.maxFileBytes;
  if (maxFileBytes === undefined) return;
  const oversized = files.filter(({ file }) => file.size > maxFileBytes);
  if (oversized.length > 0) {
    const paths = oversized.slice(0, 5).map(({ relativePath }) => relativePath);
    throw new Error(
      `파일당 서버 한도 ${formatBytes(maxFileBytes)}를 초과한 파일 ${oversized.length}개: ${paths.join(', ')}${oversized.length > 5 ? ` 외 ${oversized.length - 5}개` : ''}. 파일을 임의로 제외하지 않았습니다. 해당 파일을 나누거나 선택 폴더 밖으로 옮긴 뒤 다시 선택해주세요. 아직 서버에는 전송되지 않았습니다.`,
    );
  }
}

export function assertUploadWithinLimits(
  files: number,
  bytes: number,
  batches: number,
  limits: RepositoryUploadLimits,
): void {
  if (files > limits.maxFiles) {
    throw new Error(
      `선택한 파일 ${files.toLocaleString()}개가 서버 한도 ${limits.maxFiles.toLocaleString()}개를 초과합니다. 폴더를 나누어 올려주세요. 아직 서버에는 전송되지 않았습니다.`,
    );
  }
  if (bytes > limits.maxTotalBytes) {
    throw new Error(
      `선택한 용량 ${formatBytes(bytes)}가 서버 한도 ${formatBytes(limits.maxTotalBytes)}를 초과합니다. 폴더를 나누어 올려주세요. 아직 서버에는 전송되지 않았습니다.`,
    );
  }
  if (batches > limits.maxBatches) {
    throw new Error(
      `업로드 배치가 서버 한도 ${limits.maxBatches.toLocaleString()}개를 초과합니다. 폴더를 나누어 올려주세요.`,
    );
  }
}
