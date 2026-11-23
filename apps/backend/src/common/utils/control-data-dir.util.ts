import { mkdirSync } from 'node:fs';
import path from 'node:path';

/**
 * 설치본처럼 앱 폴더에 쓸 수 없는 환경에서 Control 이 파일을 쓰는 폴더.
 * CONTROL_DATA_DIR 이 없으면 null 이고, 각 호출부는 지금까지의 저장소 기준 경로를 쓴다.
 */
export function resolveControlDataDir(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const configured = env.CONTROL_DATA_DIR?.trim();
  return configured ? path.resolve(configured) : null;
}

/** CONTROL_DATA_DIR 아래 폴더를 만들고 경로를 돌려준다. 설정이 없으면 null. */
export function controlDataPath(...segments: string[]): string | null {
  const root = resolveControlDataDir();
  if (!root) return null;
  const target = path.join(root, ...segments);
  mkdirSync(target, { recursive: true });
  return target;
}

/** CONTROL_DATA_DIR 아래 파일 경로를 돌려주고 부모 폴더만 만든다. 설정이 없으면 null. */
export function controlDataFile(...segments: string[]): string | null {
  const root = resolveControlDataDir();
  if (!root) return null;
  const target = path.join(root, ...segments);
  mkdirSync(path.dirname(target), { recursive: true });
  return target;
}
