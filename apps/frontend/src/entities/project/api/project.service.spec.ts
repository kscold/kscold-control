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
    vi.useRealTimers();
  });

  it.each(['limits', 'latest', 'session'] as const)(
    '%s 조회의 일시적인 504 응답을 같은 요청으로 재시도한다',
    async (kind) => {
      vi.useFakeTimers();
      const item = { id: 'session-id', status: 'uploading' };
      const data = kind === 'limits' ? { maxFiles: 100_000 } : { item };
      const get = vi
        .spyOn(api, 'get')
        .mockRejectedValueOnce(axiosError({ message: 'gateway timeout' }, 504))
        .mockResolvedValueOnce({ data });
      const service = new RepositoryService();
      const execution =
        kind === 'limits'
          ? service.getUploadLimits()
          : kind === 'latest'
            ? service.getLatestUploadSession('project-id')
            : service.getUploadSession('project-id', 'session-id');

      await vi.runAllTimersAsync();
      expect(await execution).toBe(kind === 'limits' ? data : item);
      expect(get).toHaveBeenCalledTimes(2);
      expect(get.mock.calls[0]).toEqual(get.mock.calls[1]);
    },
  );

  it('상태 조회의 권한 거절은 재시도하지 않는다', async () => {
    const get = vi
      .spyOn(api, 'get')
      .mockRejectedValue(axiosError({ message: '접근 권한 없음' }, 403));
    await expect(
      new RepositoryService().getUploadSession('project-id', 'session-id'),
    ).rejects.toThrow('접근 권한 없음');
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('상태 조회 재시도를 세 번으로 제한하고 오류를 전달한다', async () => {
    vi.useFakeTimers();
    const get = vi
      .spyOn(api, 'get')
      .mockRejectedValue(axiosError({ message: 'gateway timeout' }, 504));
    const assertion = expect(
      new RepositoryService().getLatestUploadSession('project-id'),
    ).rejects.toThrow('gateway timeout');
    await vi.runAllTimersAsync();
    await assertion;
    expect(get).toHaveBeenCalledTimes(3);
  });

  it('최종 반영 응답 유실 시 같은 세션으로만 재시도한다', async () => {
    vi.useFakeTimers();
    const result = { session: { status: 'completed' } };
    const post = vi
      .spyOn(api, 'post')
      .mockRejectedValueOnce(axiosError({ message: 'gateway timeout' }, 504))
      .mockResolvedValueOnce({ data: result });
    const execution = new RepositoryService().finalizeUploadSession(
      'project-id',
      'session-id',
    );
    await vi.runAllTimersAsync();
    expect(await execution).toBe(result);
    expect(post).toHaveBeenCalledTimes(2);
    expect(post.mock.calls[0]).toEqual(post.mock.calls[1]);
  });

  it('요청 검증 오류 배열의 이유를 숨기지 않는다', async () => {
    vi.spyOn(api, 'post').mockRejectedValue(
      axiosError({ message: ['업로드 파일 수 한도 초과'] }),
    );
    await expect(
      new RepositoryService().createUploadSession('project', {} as never),
    ).rejects.toThrow('업로드 파일 수 한도 초과');
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
