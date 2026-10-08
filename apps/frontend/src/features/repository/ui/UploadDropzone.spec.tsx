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
import { useModalStore } from '@/shared/model/modal.store';
import { useAuthStore } from '@/shared/model/auth.store';
import { Modal } from '@/shared/ui/Modal';

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
  beforeEach(() => {
    useModalStore.getState().close();
    vi.spyOn(repositoryService, 'getUploadLimits').mockResolvedValue({
      maxFiles: 100000,
      maxTotalBytes: 2 * 1024 ** 3,
      maxBatches: 4000,
    });
  });
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

  async function selectFile() {
    const bytes = new TextEncoder().encode('content');
    const file = new File([bytes], 'index.ts');
    Object.defineProperty(file, 'arrayBuffer', {
      value: async () => bytes.buffer,
    });
    fireEvent.change(document.querySelector('input[type="file"]')!, {
      target: { files: [file] },
    });
    await screen.findByTestId('repository-upload-ready');
  }

  it('세션 생성 실패 사유를 alert와 인라인에 표시하고 선택한 파일을 보존한다', async () => {
    vi.spyOn(repositoryService, 'getLatestUploadSession').mockResolvedValue(
      null,
    );
    vi.spyOn(repositoryService, 'createUploadSession').mockRejectedValue(
      new Error('파일 수 한도 초과'),
    );
    render(
      <>
        <UploadDropzone project={project} onUploaded={vi.fn()} />
        <Modal />
      </>,
    );
    await selectFile();
    fireEvent.click(screen.getByRole('button', { name: '업로드 시작' }));
    expect(await screen.findByRole('alertdialog')).toHaveTextContent(
      '파일 수 한도 초과',
    );
    expect(screen.getByRole('alert')).toHaveTextContent('파일 수 한도 초과');
    expect(screen.getByTestId('repository-upload-ready')).toBeVisible();
  });

  it('인증 갱신 대기 중에도 즉시 진행 표시하고 중복 클릭을 막는다', async () => {
    vi.spyOn(repositoryService, 'getLatestUploadSession').mockResolvedValue(
      null,
    );
    let resolveRefresh!: (value: boolean) => void;
    const refresh = vi
      .spyOn(useAuthStore.getState(), 'ensureFreshToken')
      .mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveRefresh = resolve;
          }),
      );
    vi.spyOn(repositoryService, 'createUploadSession').mockRejectedValue(
      new Error('테스트 종료'),
    );
    const activity = vi.fn();
    render(
      <UploadDropzone
        project={project}
        onUploaded={vi.fn()}
        onUploadActivityChange={activity}
      />,
    );
    await selectFile();
    const button = screen.getByRole('button', { name: '업로드 시작' });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(activity).toHaveBeenCalledWith(
      expect.objectContaining({
        phase: 'preparing',
        message: expect.stringContaining('로그인'),
      }),
    );
    expect(screen.getByText(/업로드 중/)).toBeVisible();
    resolveRefresh(false);
    await screen.findByRole('alert');
  });

  it('모두 제외된 폴더는 alert를 표시하고 분석 스피너를 종료한다', async () => {
    vi.spyOn(repositoryService, 'getLatestUploadSession').mockResolvedValue(
      null,
    );
    render(<UploadDropzone project={project} onUploaded={vi.fn()} />);
    fireEvent.change(document.querySelector('input[type="file"]')!, {
      target: { files: [new File(['x'], 'image.png')] },
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('전부 필터링됨');
    expect(screen.queryByText('파일 분석 중...')).not.toBeInTheDocument();
    expect(useModalStore.getState().isOpen).toBe(true);
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
    expect(onUploadActivityChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        phase: 'success',
        batchCurrent: 1,
        batchTotal: 1,
      }),
    );
  });
});
