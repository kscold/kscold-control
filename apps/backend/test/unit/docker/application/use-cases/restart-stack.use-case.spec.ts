import { RestartStackUseCase } from '@/docker/application/use-cases/restart-stack.use-case';

const containers = [
  {
    id: 'a',
    name: 'blog-api',
    labels: { 'com.docker.compose.project': 'blog' },
  },
  {
    id: 'b',
    name: 'blog-web',
    labels: { 'com.docker.compose.project': 'blog' },
  },
  { id: 'c', name: 'other', labels: {} },
];

describe('RestartStackUseCase', () => {
  it('같은 project 라벨 컨테이너만 차례로 재시작한다', async () => {
    const docker = {
      listContainers: vi.fn().mockResolvedValue(containers),
      restartContainer: vi.fn().mockResolvedValue(undefined),
    };
    const useCase = new RestartStackUseCase(docker as never);
    await expect(useCase.execute('blog')).resolves.toEqual({
      restarted: ['blog-api', 'blog-web'],
    });
    expect(docker.restartContainer.mock.calls).toEqual([['a'], ['b']]);
  });

  it('일반 사용자는 스택을 재시작할 수 없다', async () => {
    const docker = { listContainers: vi.fn(), restartContainer: vi.fn() };
    await expect(
      new RestartStackUseCase(docker as never).execute('blog', 'me'),
    ).rejects.toThrow();
    expect(docker.listContainers).not.toHaveBeenCalled();
  });

  it('없는 스택이면 알린다', async () => {
    const docker = {
      listContainers: vi.fn().mockResolvedValue(containers),
      restartContainer: vi.fn(),
    };
    await expect(
      new RestartStackUseCase(docker as never).execute('nope'),
    ).rejects.toThrow('nope');
  });
});
