import { RestartContainerUseCase } from '@/docker/application/use-cases/restart-container.use-case';

describe('RestartContainerUseCase', () => {
  it('일반 사용자는 자기 컨테이너가 아니면 재시작할 수 없다', async () => {
    const repo = { findByDockerId: vi.fn().mockResolvedValue(null) };
    const client = { restartContainer: vi.fn() };
    const useCase = new RestartContainerUseCase(repo as never, client as never);
    await expect(useCase.execute('abc', 'me')).rejects.toThrow();
    expect(client.restartContainer).not.toHaveBeenCalled();
  });

  it('관리자는 외부 컨테이너도 Docker ID 로 재시작한다', async () => {
    const client = { restartContainer: vi.fn().mockResolvedValue(undefined) };
    const useCase = new RestartContainerUseCase({} as never, client as never);
    await useCase.execute('abc');
    expect(client.restartContainer).toHaveBeenCalledWith('abc');
  });
});
