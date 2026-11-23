import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DockerComposeRuntimeAdapter } from '@/docker/infrastructure/adapters/docker-compose-runtime.adapter';

let dataDir: string;

beforeEach(() => {
  dataDir = mkdtempSync(path.join(tmpdir(), 'compose-runtime-'));
  vi.stubEnv('CONTROL_DATA_DIR', dataDir);
  vi.stubEnv('CONTROL_COMPOSE_FILE', '');
});

afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(dataDir, { recursive: true, force: true });
});

describe('DockerComposeRuntimeAdapter (새 설치)', () => {
  it('compose 파일이 아직 없으면 관리 중인 서비스가 없는 것으로 읽는다', () => {
    expect(new DockerComposeRuntimeAdapter().readCompose()).toEqual({
      services: {},
    });
  });

  it('Control 데이터 폴더에서는 첫 서비스를 쓸 때 compose 파일을 만든다', () => {
    const adapter = new DockerComposeRuntimeAdapter();
    adapter.writeCompose({
      services: { web: { image: 'nginx:alpine' } },
    } as never);
    expect(existsSync(path.join(dataDir, 'compose'))).toBe(true);
    expect(adapter.readCompose().services).toHaveProperty('web');
  });
});
