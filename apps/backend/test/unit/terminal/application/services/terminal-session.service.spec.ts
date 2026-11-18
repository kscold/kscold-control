import { NotFoundException } from '@nestjs/common';
import { TerminalSessionService } from '@/terminal/application/services/terminal-session.service';

describe('TerminalSessionService', () => {
  const session = { id: 'session-1', userId: 'user-1' } as any;

  function createService() {
    const sessionRepo = {
      findByIdForUser: vi.fn(),
      updateActivity: vi.fn(),
    };
    const messageRepo = {
      findBySession: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
      deleteBySession: vi.fn(),
    };

    return {
      service: new TerminalSessionService(
        sessionRepo as any,
        messageRepo as any,
      ),
      sessionRepo,
      messageRepo,
    };
  }

  it('세션 소유자만 히스토리를 조회할 수 있다', async () => {
    const { service, sessionRepo, messageRepo } = createService();
    sessionRepo.findByIdForUser.mockResolvedValue(session);
    messageRepo.findBySession.mockResolvedValue([]);

    await expect(service.getHistory('session-1', 'user-1')).resolves.toEqual(
      [],
    );
    expect(sessionRepo.findByIdForUser).toHaveBeenCalledWith(
      'session-1',
      'user-1',
    );
  });

  it('다른 사용자의 세션에는 메시지를 저장하지 않는다', async () => {
    const { service, sessionRepo, messageRepo } = createService();
    sessionRepo.findByIdForUser.mockResolvedValue(null);

    await expect(
      service.saveMessage('session-1', 'user-2', 'user', 'secret'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(messageRepo.create).not.toHaveBeenCalled();
    expect(messageRepo.save).not.toHaveBeenCalled();
  });
});
