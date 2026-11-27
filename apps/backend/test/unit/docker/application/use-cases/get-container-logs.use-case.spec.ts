import {
  GetContainerLogsUseCase,
  clampLogLines,
} from '@/docker/application/use-cases/get-container-logs.use-case';
import { demuxDockerLogs } from '@/docker/infrastructure/adapters/dockerode-client.adapter';

function frame(stream: number, text: string): Buffer {
  const body = Buffer.from(text, 'utf8');
  const head = Buffer.alloc(8);
  head[0] = stream;
  head.writeUInt32BE(body.length, 4);
  return Buffer.concat([head, body]);
}

describe('컨테이너 로그', () => {
  it('줄 수는 기본 300, 최대 2000 으로 맞춘다', () => {
    expect(clampLogLines(undefined)).toBe(300);
    expect(clampLogLines('abc')).toBe(300);
    expect(clampLogLines('50')).toBe(50);
    expect(clampLogLines('99999')).toBe(2000);
  });

  it('도커 로그 머리(8바이트)를 떼고 표준 출력·오류를 순서대로 잇는다', () => {
    const raw = Buffer.concat([
      frame(1, '시작\n'),
      frame(2, '오류\n'),
      frame(1, '끝\n'),
    ]);
    expect(demuxDockerLogs(raw)).toBe('시작\n오류\n끝\n');
  });

  it('TTY 컨테이너처럼 머리가 없으면 그대로 돌려준다', () => {
    expect(demuxDockerLogs(Buffer.from('plain log\n'))).toBe('plain log\n');
  });

  it('일반 사용자는 자기 컨테이너가 아니면 읽을 수 없다', async () => {
    const repo = {
      findByDockerId: vi.fn().mockResolvedValue({ userId: 'other' }),
    };
    const client = { getContainerLogs: vi.fn() };
    const useCase = new GetContainerLogsUseCase(repo as never, client as never);
    await expect(useCase.execute('abc', 10, 'me')).rejects.toThrow();
    expect(client.getContainerLogs).not.toHaveBeenCalled();
  });

  it('관리자는 외부 컨테이너 로그도 읽는다', async () => {
    const client = { getContainerLogs: vi.fn().mockResolvedValue('hi') };
    const useCase = new GetContainerLogsUseCase({} as never, client as never);
    await expect(useCase.execute('abc', '20')).resolves.toEqual({
      lines: 20,
      text: 'hi',
    });
    expect(client.getContainerLogs).toHaveBeenCalledWith('abc', 20);
  });
});
