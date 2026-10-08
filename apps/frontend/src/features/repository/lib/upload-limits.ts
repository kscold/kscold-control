import type { RepositoryUploadLimits } from '@/entities/project';
import { formatBytes } from '@/shared/lib';

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
