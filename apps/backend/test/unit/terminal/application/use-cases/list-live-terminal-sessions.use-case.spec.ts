import { ListLiveTerminalSessionsUseCase } from '@/terminal/application/use-cases/list-live-terminal-sessions.use-case';

describe('ListLiveTerminalSessionsUseCase', () => {
  it('셸이 살아 있는 내 세션만 돌려준다', async () => {
    const sessions = {
      listActiveForUser: vi.fn().mockResolvedValue([
        {
          id: 'a',
          title: '터미널',
          createdAt: new Date('2026-11-28T00:00:00Z'),
          lastActivityAt: null,
        },
        {
          id: 'b',
          title: '끝난 셸',
          createdAt: new Date('2026-11-28T00:00:00Z'),
          lastActivityAt: null,
        },
      ]),
    };
    const pty = { hasPty: (id: string) => id === 'a' };
    const useCase = new ListLiveTerminalSessionsUseCase(
      sessions as never,
      pty as never,
    );
    await expect(useCase.execute('u1')).resolves.toEqual([
      {
        id: 'a',
        title: '터미널',
        createdAt: '2026-11-28T00:00:00.000Z',
        lastActivityAt: null,
      },
    ]);
    expect(sessions.listActiveForUser).toHaveBeenCalledWith('u1');
  });
});
