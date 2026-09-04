import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LocalFileStorageService } from '@/repository/infrastructure/storage/local-file-storage.service';

describe('LocalFileStorageService', () => {
  let root: string;
  let storage: LocalFileStorageService;
  let previousStorageDir: string | undefined;

  beforeEach(async () => {
    previousStorageDir = process.env.REPOSITORY_STORAGE_DIR;
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'control-repository-test-'));
    process.env.REPOSITORY_STORAGE_DIR = root;
    storage = new LocalFileStorageService();
    await storage.onModuleInit();
  });

  afterEach(async () => {
    if (previousStorageDir === undefined) {
      delete process.env.REPOSITORY_STORAGE_DIR;
    } else {
      process.env.REPOSITORY_STORAGE_DIR = previousStorageDir;
    }
    await fs.rm(root, { recursive: true, force: true });
  });

  async function seedLiveFile(
    projectName: string,
    relativePath: string,
    content: Buffer,
  ) {
    const target = path.join(root, projectName, ...relativePath.split('/'));
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content);
  }

  it('최종 반영 전에는 라이브 파일을 변경하지 않는다', async () => {
    const sessionId = randomUUID();
    await storage.ensureProject('atomic-project');
    await seedLiveFile('atomic-project', 'old.txt', Buffer.from('old source'));

    await storage.prepareStagedUpload('atomic-project', sessionId, true);
    await storage.writeStagedFile(
      'atomic-project',
      sessionId,
      'new.txt',
      Buffer.from('new source'),
    );

    await expect(
      storage.readFile('atomic-project', 'old.txt'),
    ).resolves.toEqual(Buffer.from('old source'));
    await expect(
      storage.readFile('atomic-project', 'new.txt'),
    ).rejects.toMatchObject({ code: 'ENOENT' });

    const finalized = await storage.finalizeStagedUpload(
      'atomic-project',
      sessionId,
    );
    await expect(
      storage.readFile('atomic-project', 'new.txt'),
    ).resolves.toEqual(Buffer.from('new source'));
    await expect(
      storage.readFile('atomic-project', 'old.txt'),
    ).rejects.toMatchObject({ code: 'ENOENT' });
    expect(finalized.stats).toEqual({ fileCount: 1, totalSize: 10 });
    expect(await storage.listVersions('atomic-project')).toHaveLength(1);
  });

  it('반영 영수증으로 같은 최종 반영 요청을 멱등 처리한다', async () => {
    const sessionId = randomUUID();
    await storage.ensureProject('retry-project');
    await storage.prepareStagedUpload('retry-project', sessionId, true);
    await storage.writeStagedFile(
      'retry-project',
      sessionId,
      'index.ts',
      Buffer.from('export {};'),
    );

    const first = await storage.finalizeStagedUpload(
      'retry-project',
      sessionId,
    );
    const second = await storage.finalizeStagedUpload(
      'retry-project',
      sessionId,
    );

    expect(second.version.id).toBe(first.version.id);
    await expect(
      storage.inspectStagedUpload('retry-project', sessionId),
    ).resolves.toMatchObject({
      source: 'published',
      stats: { fileCount: 1, totalSize: 10 },
    });
    expect(await storage.listVersions('retry-project')).toHaveLength(1);
  });

  it('반영 완료 영수증 뒤에 남은 스테이징은 폐기하고 라이브를 기준으로 복구한다', async () => {
    const sessionId = randomUUID();
    await storage.ensureProject('receipt-project');
    await storage.prepareStagedUpload('receipt-project', sessionId, true);
    await storage.writeStagedFile(
      'receipt-project',
      sessionId,
      'live.txt',
      Buffer.from('published'),
    );
    await storage.finalizeStagedUpload('receipt-project', sessionId);

    await storage.prepareStagedUpload('receipt-project', sessionId, true);
    await storage.writeStagedFile(
      'receipt-project',
      sessionId,
      'stale.txt',
      Buffer.from('stale'),
    );

    const inspection = await storage.inspectStagedUpload(
      'receipt-project',
      sessionId,
    );
    expect(inspection.source).toBe('published');
    expect(inspection.files.map((file) => file.relativePath)).toEqual([
      'live.txt',
    ]);
  });

  it('라이브 이동 직후 중단된 prepared 영수증을 부팅 시 복구한다', async () => {
    const projectName = 'recovery-project';
    const sessionId = randomUUID();
    await storage.ensureProject(projectName);
    await seedLiveFile(projectName, 'old.txt', Buffer.from('old'));
    await storage.prepareStagedUpload(projectName, sessionId, true);
    await storage.writeStagedFile(
      projectName,
      sessionId,
      'new.txt',
      Buffer.from('new'),
    );

    const backup = path.join(root, '.upload-backups', projectName, sessionId);
    const receiptDirectory = path.join(root, '.upload-receipts', projectName);
    await fs.mkdir(path.dirname(backup), { recursive: true });
    await fs.mkdir(receiptDirectory, { recursive: true });
    await fs.rename(path.join(root, projectName), backup);
    await fs.writeFile(
      path.join(receiptDirectory, `${sessionId}.json`),
      JSON.stringify({
        protocolVersion: 1,
        projectName,
        sessionId,
        state: 'prepared',
        version: {
          id: 'prepared-version',
          createdAt: new Date().toISOString(),
          compressedSize: 1,
          filename: 'prepared-version.tar.gz',
        },
        publishedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    );

    const restarted = new LocalFileStorageService();
    await restarted.onModuleInit();

    await expect(restarted.readFile(projectName, 'new.txt')).resolves.toEqual(
      Buffer.from('new'),
    );
    await expect(fs.access(backup)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('손상된 버전 복원이 실패해도 라이브 파일을 보존한다', async () => {
    await storage.ensureProject('restore-project');
    await seedLiveFile(
      'restore-project',
      'live.txt',
      Buffer.from('must survive'),
    );
    const versionsDir = path.join(
      root,
      '.repository-versions',
      'restore-project',
    );
    await fs.mkdir(versionsDir, { recursive: true });
    await fs.writeFile(path.join(versionsDir, 'broken.tar.gz'), 'not a tar');

    await expect(
      storage.restoreVersion('restore-project', 'broken'),
    ).rejects.toThrow('버전 아카이브 검증 실패');
    await expect(
      storage.readFile('restore-project', 'live.txt'),
    ).resolves.toEqual(Buffer.from('must survive'));
  });

  it('정상 버전 복원도 원자 반영 영수증을 사용하고 버전을 중복 생성하지 않는다', async () => {
    await storage.ensureProject('version-restore-project');
    await seedLiveFile(
      'version-restore-project',
      'state.txt',
      Buffer.from('version one'),
    );
    const version = await storage.createSnapshot('version-restore-project');
    await seedLiveFile(
      'version-restore-project',
      'state.txt',
      Buffer.from('version two'),
    );

    await storage.restoreVersion('version-restore-project', version.id);

    await expect(
      storage.readFile('version-restore-project', 'state.txt'),
    ).resolves.toEqual(Buffer.from('version one'));
    expect(await storage.listVersions('version-restore-project')).toHaveLength(
      1,
    );
    const receiptProjects = await fs.readdir(
      path.join(root, '.upload-receipts'),
    );
    expect(receiptProjects).toContain('version-restore-project');
  });

  it('merge 스테이징은 기존 파일을 보존한 완성본을 만든다', async () => {
    const sessionId = randomUUID();
    await storage.ensureProject('merge-project');
    await seedLiveFile('merge-project', 'old.txt', Buffer.from('old'));
    await storage.prepareStagedUpload('merge-project', sessionId, false);
    await storage.writeStagedFile(
      'merge-project',
      sessionId,
      'new.txt',
      Buffer.from('new'),
    );
    await storage.finalizeStagedUpload('merge-project', sessionId);

    await expect(storage.readFile('merge-project', 'old.txt')).resolves.toEqual(
      Buffer.from('old'),
    );
    await expect(storage.readFile('merge-project', 'new.txt')).resolves.toEqual(
      Buffer.from('new'),
    );
  });

  it('기존 저장소에 남은 민감 파일은 트리와 다운로드에서 노출하지 않는다', async () => {
    await storage.ensureProject('legacy-secret-project');
    await seedLiveFile(
      'legacy-secret-project',
      '.env',
      Buffer.from('SECRET=value'),
    );
    await seedLiveFile(
      'legacy-secret-project',
      'README.md',
      Buffer.from('safe'),
    );

    const tree = await storage.listTree('legacy-secret-project');
    expect(tree.children?.map((item) => item.name)).toEqual(['README.md']);
    await expect(
      storage.archiveProject('legacy-secret-project'),
    ).rejects.toThrow('민감 파일은 소스 저장소에 포함할 수 없습니다');
  });
});
