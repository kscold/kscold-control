import { Inject, Injectable } from '@nestjs/common';
import {
  SESSION_REPOSITORY,
  type ISessionRepository,
} from '../../domain/repositories/session.repository.interface';
import { PtyManagerService } from '../services/pty-manager.service';

export interface LiveTerminalSession {
  id: string;
  title: string;
  createdAt: string;
  lastActivityAt: string | null;
}

/**
 * 지금 셸이 살아 있는 내 터미널 세션.
 * 다른 기기(휴대폰)에서 데스크톱에서 열어 둔 셸·Claude 에 다시 붙을 때 고른다.
 */
@Injectable()
export class ListLiveTerminalSessionsUseCase {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: ISessionRepository,
    private readonly pty: PtyManagerService,
  ) {}

  async execute(userId: string): Promise<LiveTerminalSession[]> {
    const active = await this.sessions.listActiveForUser(userId);
    return active
      .filter((session) => this.pty.hasPty(session.id))
      .map((session) => ({
        id: session.id,
        title: session.title,
        createdAt: session.createdAt.toISOString(),
        lastActivityAt: session.lastActivityAt?.toISOString() ?? null,
      }));
  }
}
