import { parseDockerSizeToBytes } from '../../../common/utils/docker-disk-usage.util';
import type { DockerUsageSnapshot } from '../types/storage.type';

/** 컨테이너 쓰기 레이어가 이보다 크면 안에 캐시·파일이 쌓인 것으로 본다 */
export const CONTAINER_LAYER_WARNING_BYTES = 5 * 1024 ** 3;

/** `docker system df -v --format '{{json .}}'` 출력 중 쓰는 필드 */
export interface DockerSystemDfJson {
  Images?: Array<{
    ID?: string;
    Repository?: string;
    Tag?: string;
    Size?: string;
    UniqueSize?: string;
    Containers?: string;
  }>;
  Containers?: Array<{
    Names?: string;
    Image?: string;
    State?: string;
    Size?: string;
  }>;
  Volumes?: Array<{
    Name?: string;
    Size?: string;
    Links?: string;
    Labels?: string;
  }>;
  BuildCache?: Array<{ Size?: string }> | null;
}

/** `df -B1 --output=size,used,avail` 출력에서 사용 중인 바이트를 꺼낸다 */
export function parseDfUsedBytes(output: string): number | null {
  const lastLine = output.trim().split('\n').at(-1)?.trim() ?? '';
  const [size, used] = lastLine.split(/\s+/).map(Number);
  return Number.isFinite(size) && size > 0 && Number.isFinite(used)
    ? used
    : null;
}

/** `lsof -F fts` 출력에서 지워졌지만 열려 있는 일반 파일의 크기를 더한다 */
export function sumDeletedOpenFiles(output: string): {
  bytes: number;
  files: number;
} {
  let bytes = 0;
  let files = 0;
  let type = '';
  for (const line of output.split('\n')) {
    if (line.startsWith('f')) {
      type = '';
    } else if (line.startsWith('t')) {
      type = line.slice(1);
    } else if (line.startsWith('s') && type === 'REG') {
      bytes += Number(line.slice(1)) || 0;
      files += 1;
    }
  }
  return { bytes, files };
}

/** `fstrim -v` 출력에서 비운 바이트를 꺼낸다 */
export function parseFstrimBytes(output: string): number | null {
  const match = /\((\d+) bytes\) trimmed/.exec(output);
  return match ? Number(match[1]) : null;
}

/** 도커 사용량 JSON을 저장공간 화면에서 쓰는 형태로 바꾼다 */
export function toDockerUsageSnapshot(
  json: DockerSystemDfJson,
): DockerUsageSnapshot {
  const containers = (json.Containers ?? [])
    .map((container) => {
      const writableBytes = parseDockerSizeToBytes(container.Size ?? '0B');
      return {
        name: container.Names ?? '',
        image: container.Image ?? '',
        state: container.State ?? '',
        writableBytes,
        oversized: writableBytes >= CONTAINER_LAYER_WARNING_BYTES,
      };
    })
    .sort((left, right) => right.writableBytes - left.writableBytes);

  const unusedImages = (json.Images ?? [])
    .filter((image) => Number(image.Containers ?? '0') === 0)
    .map((image) => ({
      id: (image.ID ?? '').replace(/^sha256:/, '').slice(0, 12),
      reference:
        image.Repository && image.Repository !== '<none>'
          ? `${image.Repository}:${image.Tag ?? 'latest'}`
          : null,
      sizeBytes: parseDockerSizeToBytes(image.Size ?? '0B'),
      uniqueBytes: parseDockerSizeToBytes(image.UniqueSize ?? '0B'),
    }))
    .sort((left, right) => right.uniqueBytes - left.uniqueBytes);

  const unreferencedVolumes = (json.Volumes ?? [])
    .filter((volume) => Number(volume.Links ?? '0') === 0)
    .map((volume) => ({
      name: volume.Name ?? '',
      sizeBytes: parseDockerSizeToBytes(volume.Size ?? '0B'),
      project:
        /(?:^|,)com\.docker\.compose\.project=([^,]+)/.exec(
          volume.Labels ?? '',
        )?.[1] ?? null,
    }))
    .sort((left, right) => right.sizeBytes - left.sizeBytes);

  const buildCacheBytes = (json.BuildCache ?? []).reduce(
    (sum, entry) => sum + parseDockerSizeToBytes(entry.Size ?? '0B'),
    0,
  );

  return { containers, unusedImages, unreferencedVolumes, buildCacheBytes };
}
