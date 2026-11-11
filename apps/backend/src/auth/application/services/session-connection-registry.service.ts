import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { SessionVerifier } from './session-verifier.service';

export type CloseConnection = () => void;

export interface DisconnectableSocket {
  readonly disconnected: boolean;
  disconnect(close: boolean): unknown;
  once(event: 'disconnect', listener: () => void): unknown;
}

export const SESSION_RECHECK_INTERVAL_MS = 60 * 1000;

/** 소켓·로그 스트림·원격 화면은 열 때 한 번만 토큰을 확인하므로, 세션이 끝나면 여기서 닫는다. */
@Injectable()
export class SessionConnectionRegistry
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(SessionConnectionRegistry.name);
  private readonly connections = new Map<string, Set<CloseConnection>>();
  private timer?: NodeJS.Timeout;
  private rechecking = false;

  constructor(private readonly verifier: SessionVerifier) {}

  onModuleInit() {
    this.timer = setInterval(
      () => void this.recheck(),
      SESSION_RECHECK_INTERVAL_MS,
    );
    this.timer.unref();
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }

  bind(sessionId: string, close: CloseConnection): () => void {
    let bound = this.connections.get(sessionId);
    if (!bound) {
      bound = new Set();
      this.connections.set(sessionId, bound);
    }
    const set = bound;
    set.add(close);
    return () => {
      set.delete(close);
      if (!set.size && this.connections.get(sessionId) === set) {
        this.connections.delete(sessionId);
      }
    };
  }

  bindSocket(sessionId: string, socket: DisconnectableSocket): void {
    // 토큰을 확인하는 사이 끊긴 소켓은 disconnect 를 다시 내지 않아 묶으면 풀리지 않는다.
    if (socket.disconnected) return;
    socket.once(
      'disconnect',
      this.bind(sessionId, () => socket.disconnect(true)),
    );
  }

  closeSessions(sessionIds: Iterable<string>): void {
    for (const sessionId of sessionIds) {
      const bound = this.connections.get(sessionId);
      if (!bound) continue;
      this.connections.delete(sessionId);
      for (const close of bound) {
        try {
          close();
        } catch (error) {
          this.logger.warn(
            `세션 ${sessionId} 의 연결을 닫지 못했습니다: ${(error as Error).message}`,
          );
        }
      }
    }
  }

  /** 만료되거나 다른 곳(DB, 다른 프로세스)에서 끊긴 세션의 연결을 닫는다. */
  async recheck(): Promise<void> {
    if (this.rechecking) return;
    this.rechecking = true;
    try {
      for (const sessionId of [...this.connections.keys()]) {
        try {
          if (!(await this.verifier.isActive(sessionId))) {
            this.closeSessions([sessionId]);
          }
        } catch (error) {
          // DB 가 잠깐 안 될 때 모든 터미널을 끊지 않도록 남겨 두고 다음 차례에 다시 본다.
          this.logger.warn(
            `세션 ${sessionId} 를 다시 확인하지 못했습니다: ${(error as Error).message}`,
          );
        }
      }
    } finally {
      this.rechecking = false;
    }
  }
}
