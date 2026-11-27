import * as fs from 'fs';
import { join } from 'path';
import { FileLogReaderRepository } from '@/logs/infrastructure/repositories/file-log-reader.repository';

vi.mock('fs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('fs')>()),
  existsSync: vi.fn(),
}));

describe('FileLogReaderRepository', () => {
  const repository = new FileLogReaderRepository();

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('PM2 backend 작업 디렉터리에서 현재 로그 경로를 선택한다', () => {
    const cwd = '/workspace/apps/backend';
    vi.spyOn(process, 'cwd').mockReturnValue(cwd);
    vi.mocked(fs.existsSync).mockImplementation(
      (candidate) => candidate === join(cwd, 'logs/out.log'),
    );

    expect((repository as any).getLogPath('backend')).toBe(
      join(cwd, 'logs/out.log'),
    );
  });

  it('저장소 루트 실행에서는 backend 로그 경로를 선택한다', () => {
    const cwd = '/workspace';
    vi.spyOn(process, 'cwd').mockReturnValue(cwd);
    vi.mocked(fs.existsSync).mockImplementation(
      (candidate) => candidate === join(cwd, 'apps/backend/logs/out.log'),
    );

    expect((repository as any).getLogPath('backend')).toBe(
      join(cwd, 'apps/backend/logs/out.log'),
    );
  });

  it('PM2 가 알려 준 실제 로그 파일을 옛 위치 파일보다 먼저 쓴다', () => {
    const cwd = '/workspace/apps/backend';
    vi.spyOn(process, 'cwd').mockReturnValue(cwd);
    vi.stubEnv('pm_out_log_path', '/home/me/.pm2/logs/app-out.log');
    vi.mocked(fs.existsSync).mockReturnValue(true);

    expect((repository as any).getLogPath('backend')).toBe(
      '/home/me/.pm2/logs/app-out.log',
    );
    vi.unstubAllEnvs();
  });
});
