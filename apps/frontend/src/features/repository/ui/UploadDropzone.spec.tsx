import { webcrypto } from 'node:crypto';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  RepositoryUploadIntegrityError,
  repositoryService,
  type CreateUploadSessionInput,
  type RepositoryProject,
  type RepositoryUploadSession,
} from '@/entities/project';
import { UploadDropzone } from './UploadDropzone';

const project: RepositoryProject = {
  id: 'project-id',
  name: 'source-project',
  description: null,
  fileCount: 0,
  totalSize: 0,
  ownerId: 'owner-id',
  createdAt: '2026-09-04T00:00:00.000Z',
  updatedAt: '2026-09-04T00:00:00.000Z',
};

function makeSession(
  id: string,
  input: CreateUploadSessionInput,
  status: RepositoryUploadSession['status'] = 'pending',
): RepositoryUploadSession {
  const now = '2026-09-04T00:00:00.000Z';
  return {
    id,
    protocolVersion: input.protocolVersion,
    projectId: project.id,
    projectName: project.name,
    status,
    manifestDigest: input.manifestDigest,
    replace: input.replace,
    replaceApplied: status === 'completed',
    totalFiles: input.totalFiles,
    totalBytes: input.totalBytes,
    filteredCount: input.filteredCount,
    batchTotal: input.batches.length,
    uploadedCount: status === 'pending' ? 0 : input.totalFiles,
    uploadedBytes: status === 'pending' ? 0 : input.totalBytes,
    failedCount: 0,
    failedFiles: [],
    batches: input.batches.map((batch) => ({
      ...batch,
      status: status === 'pending' ? 'pending' : 'completed',
      uploadedCount: status === 'pending' ? 0 : batch.totalFiles,
      uploadedBytes: status === 'pending' ? 0 : batch.totalBytes,
      failedFiles: [],
      error: null,
      updatedAt: now,
    })),
    currentBatchIndex: null,
    createdAt: now,
    updatedAt: now,
    lastActivityAt: now,
    completedAt: status === 'completed' ? now : null,
    publishedAt: status === 'completed' ? now : null,
    snapshotId: status === 'completed' ? 'snapshot-id' : null,
    finalizationError: null,
  };
}

describe('UploadDropzone session recovery', () => {
  beforeAll(() => {
    if (!globalThis.crypto?.subtle) {
      Object.defineProperty(globalThis, 'crypto', {
        configurable: true,
        value: webcrypto,
      });
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('무결성 불일치가 나면 같은 스냅샷으로 새 세션을 한 번 만들어 완료한다', async () => {
    const user = userEvent.setup();
    const createdSessions: RepositoryUploadSession[] = [];
    const onUploaded = vi.fn();
    const onUploadActivityChange = vi.fn();

    vi.spyOn(repositoryService, 'getLatestUploadSession').mockResolvedValue(
      null,
    );
    const createSession = vi
      .spyOn(repositoryService, 'createUploadSession')
      .mockImplementation(async (_projectId, input) => {
        const session = makeSession(`session-${createdSessions.length}`, input);
        createdSessions.push(session);
        return session;
      });
    vi.spyOn(repositoryService, 'uploadSessionBatch')
      .mockRejectedValueOnce(
        new RepositoryUploadIntegrityError('테스트 무결성 불일치'),
      )
      .mockImplementationOnce(async () => {
        const session = {
          ...createdSessions[1],
          status: 'finalizing' as const,
          uploadedCount: 1,
          uploadedBytes: 7,
          batches: createdSessions[1].batches.map((batch) => ({
            ...batch,
            status: 'completed' as const,
            uploadedCount: batch.totalFiles,
            uploadedBytes: batch.totalBytes,
          })),
        };
        return {
          project,
          session,
          batchIndex: 0,
          uploadedCount: 1,
          failedFiles: [],
        };
      });
    vi.spyOn(repositoryService, 'finalizeUploadSession').mockImplementation(
      async () => ({
        project,
        session: {
          ...createdSessions[1],
          status: 'completed',
          replaceApplied: true,
          uploadedCount: 1,
          uploadedBytes: 7,
          completedAt: '2026-09-04T00:00:00.000Z',
          publishedAt: '2026-09-04T00:00:00.000Z',
          snapshotId: 'snapshot-id',
          batches: createdSessions[1].batches.map((batch) => ({
            ...batch,
            status: 'completed',
            uploadedCount: batch.totalFiles,
            uploadedBytes: batch.totalBytes,
          })),
        },
      }),
    );

    const { container } = render(
      <UploadDropzone
        project={project}
        onUploaded={onUploaded}
        onUploadActivityChange={onUploadActivityChange}
      />,
    );
    const bytes = new TextEncoder().encode('content');
    const file = new File([bytes], 'index.ts', { type: 'text/plain' });
    Object.defineProperties(file, {
      arrayBuffer: {
        value: async () => Uint8Array.from(bytes).buffer,
      },
      webkitRelativePath: {
        value: 'source-project/src/index.ts',
      },
    });
    const input = container.querySelector('input[type="file"]');
    expect(input).not.toBeNull();

    fireEvent.change(input!, { target: { files: [file] } });
    await screen.findByTestId('repository-upload-ready');
    await user.click(screen.getByRole('button', { name: '업로드 시작' }));

    await waitFor(() => expect(onUploaded).toHaveBeenCalledTimes(1));
    expect(createSession).toHaveBeenCalledTimes(2);
    expect(createdSessions[0].id).not.toBe(createdSessions[1].id);
    expect(createdSessions[0].manifestDigest).toBe(
      createdSessions[1].manifestDigest,
    );
    expect(onUploadActivityChange).toHaveBeenCalledWith(
      expect.objectContaining({
        message:
          '서버 세션과 파일 스냅샷이 달라 새 세션으로 자동 복구하고 있습니다.',
      }),
    );
  });
});
