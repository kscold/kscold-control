import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LocalUploadSessionRepository } from '@/repository/infrastructure/repositories/local-upload-session.repository';
import type { RepositoryUploadSession } from '@/repository/domain/types/upload-session.type';

function session(projectId: string): RepositoryUploadSession {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    protocolVersion: 2,
    projectId,
    projectName: 'session-project',
    status: 'pending',
    manifestDigest: `sha256:${'a'.repeat(64)}`,
    replace: true,
    replaceApplied: false,
    totalFiles: 1,
    totalBytes: 4,
    filteredCount: 0,
    batchTotal: 1,
    uploadedCount: 0,
    uploadedBytes: 0,
    failedCount: 0,
    failedFiles: [],
    batches: [],
    currentBatchIndex: null,
    createdAt: now,
    updatedAt: now,
    lastActivityAt: now,
    completedAt: null,
    publishedAt: null,
    snapshotId: null,
    finalizationError: null,
  };
}

describe('LocalUploadSessionRepository', () => {
  let root: string;
  let repository: LocalUploadSessionRepository;
  let previousStorageDir: string | undefined;

  beforeEach(async () => {
    previousStorageDir = process.env.REPOSITORY_STORAGE_DIR;
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'upload-session-test-'));
    process.env.REPOSITORY_STORAGE_DIR = root;
    repository = new LocalUploadSessionRepository();
  });

  afterEach(async () => {
    if (previousStorageDir === undefined) {
      delete process.env.REPOSITORY_STORAGE_DIR;
    } else {
      process.env.REPOSITORY_STORAGE_DIR = previousStorageDir;
    }
    await fs.rm(root, { recursive: true, force: true });
  });

  it('파일 위치와 내부 프로젝트 식별자가 다른 세션을 거부한다', async () => {
    const item = session('project-a');
    await repository.create(item);
    const filePath = path.join(
      root,
      '.upload-sessions',
      item.projectId,
      `${item.id}.json`,
    );
    await fs.writeFile(
      filePath,
      JSON.stringify({ ...item, projectId: 'project-b' }),
    );

    await expect(repository.findById(item.projectId, item.id)).rejects.toThrow(
      '업로드 세션 식별자 또는 필수 구조가 손상되었습니다',
    );
  });

  it('손상된 최신 파일은 건너뛰고 정상 세션을 반환한다', async () => {
    const item = session('project-a');
    await repository.create(item);
    await fs.writeFile(
      path.join(
        root,
        '.upload-sessions',
        item.projectId,
        `${randomUUID()}.json`,
      ),
      '{broken',
    );

    await expect(
      repository.findLatestByProject(item.projectId),
    ).resolves.toMatchObject({
      id: item.id,
      projectId: item.projectId,
    });
  });

  it('프로젝트 삭제 시 세션 디렉터리도 함께 제거한다', async () => {
    const item = session('project-a');
    await repository.create(item);

    await repository.removeByProject(item.projectId);

    await expect(
      repository.findById(item.projectId, item.id),
    ).resolves.toBeNull();
  });
});
