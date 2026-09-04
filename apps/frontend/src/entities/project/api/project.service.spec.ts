import { AxiosError, type AxiosResponse } from 'axios';
import { api } from '@/shared/api/client';
import {
  RepositoryService,
  RepositoryUploadIntegrityError,
} from './project.service';

function axiosError(data: unknown, status = 400): AxiosError {
  const error = new AxiosError('Request failed');
  error.response = {
    data,
    status,
    statusText: 'Bad Request',
    headers: {},
    config: { headers: {} },
  } as AxiosResponse;
  return error;
}

describe('RepositoryService upload errors', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('서버 무결성 코드를 자동 세션 복구용 오류로 변환한다', async () => {
    vi.spyOn(api, 'post').mockRejectedValue(
      axiosError({
        code: 'REPOSITORY_UPLOAD_INTEGRITY_MISMATCH',
        message: '배치 파일 무결성 검증에 실패했습니다: src/index.ts',
      }),
    );
    const service = new RepositoryService();
    const bytes = new TextEncoder().encode('content');

    await expect(
      service.uploadSessionBatch('project-id', 'session-id', 0, [
        {
          relativePath: 'src/index.ts',
          file: {
            name: 'index.ts',
            size: bytes.byteLength,
            arrayBuffer: async () => Uint8Array.from(bytes).buffer,
          } as File,
        },
      ]),
    ).rejects.toEqual(
      expect.objectContaining({
        name: RepositoryUploadIntegrityError.name,
        message: expect.stringContaining('src/index.ts'),
      }),
    );
  });

  it('일반 400 오류는 자동 세션 복구 오류로 바꾸지 않는다', async () => {
    vi.spyOn(api, 'post').mockRejectedValue(
      axiosError({
        message: '민감한 키 자료가 포함되어 업로드를 중단했습니다.',
      }),
    );
    const service = new RepositoryService();
    const bytes = new TextEncoder().encode('secret');

    const execution = service.uploadSessionBatch(
      'project-id',
      'session-id',
      0,
      [
        {
          relativePath: 'src/index.ts',
          file: {
            name: 'index.ts',
            size: bytes.byteLength,
            arrayBuffer: async () => Uint8Array.from(bytes).buffer,
          } as File,
        },
      ],
    );

    await expect(execution).rejects.not.toBeInstanceOf(
      RepositoryUploadIntegrityError,
    );
    await expect(execution).rejects.toThrow('민감한 키 자료');
  });
});
