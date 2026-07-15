import { GetLogsUseCase } from '@/logs/application/use-cases/get-logs.use-case';

describe('GetLogsUseCase', () => {
  const fileLogReader = { readLogs: jest.fn() };
  const dockerLogReader = { readContainerLogs: jest.fn() };
  const blogLogReader = { readBlogLogs: jest.fn() };
  const useCase = new GetLogsUseCase(
    fileLogReader as any,
    dockerLogReader as any,
    blogLogReader as any,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('블로그 로그는 전용 읽기 포트에 위임한다', async () => {
    blogLogReader.readBlogLogs.mockResolvedValueOnce(['blog line']);

    await expect(useCase.execute('blog-backend', 50)).resolves.toEqual([
      'blog line',
    ]);
    expect(blogLogReader.readBlogLogs).toHaveBeenCalledWith('blog-backend', 50);
  });

  it('Docker 로그는 Docker 읽기 포트에 위임한다', async () => {
    dockerLogReader.readContainerLogs.mockResolvedValueOnce(['docker line']);

    await expect(
      useCase.execute('docker', 20, 'container-1', {
        tail: 10,
        timestamps: true,
      }),
    ).resolves.toEqual(['docker line']);
    expect(dockerLogReader.readContainerLogs).toHaveBeenCalledWith({
      containerId: 'container-1',
      containerName: undefined,
      tail: 10,
      timestamps: true,
      since: undefined,
      until: undefined,
      filter: 'all',
    });
  });
});
