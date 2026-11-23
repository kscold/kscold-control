import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  controlDataFile,
  controlDataPath,
  resolveControlDataDir,
} from '@/common/utils/control-data-dir.util';

afterEach(() => vi.unstubAllEnvs());

describe('Control 데이터 폴더', () => {
  it('설정이 없으면 null 을 돌려 기존 경로를 쓰게 한다', () => {
    vi.stubEnv('CONTROL_DATA_DIR', '');
    expect(resolveControlDataDir()).toBeNull();
    expect(controlDataPath('logs')).toBeNull();
  });

  it('설정이 있으면 하위 폴더를 만들고 파일은 부모 폴더만 만든다', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'control-data-'));
    vi.stubEnv('CONTROL_DATA_DIR', root);
    try {
      expect(controlDataPath('nginx', 'conf.d')).toBe(
        path.join(root, 'nginx', 'conf.d'),
      );
      expect(existsSync(path.join(root, 'nginx', 'conf.d'))).toBe(true);
      expect(controlDataFile('audit-log.jsonl')).toBe(
        path.join(root, 'audit-log.jsonl'),
      );
      expect(existsSync(path.join(root, 'audit-log.jsonl'))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
