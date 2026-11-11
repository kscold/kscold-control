import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { SessionVerifier } from './session-verifier.service';

/** 세션이 끝나면 부를, 긴 연결(소켓, 로그 스트림, 원격 화면)을 닫는 함수 */
export type CloseConnection = () => void;

/** socket.io 소켓에서 묶고 푸는 데 쓰는 부분만 받는다. */
export interface DisconnectableSocket {
  readonly disconnected: boolean;
  disconnect(close: boolean): unknown;
  once(event: 'disconnect', listener: () => void): unknown;
}

export const SESSION_RECHECK_INTERVAL_MS = 60 * 1000;

/**
 * 서버 세션에 묶인 긴 연결을 세션 id 별로 모은다.
 * 긴 연결은 열 때 한 번만 토큰을 확인하므로, 세션이 끝나면 여기서 그 세션의 연결을 닫는다.
 * 이 프로세스가 끊은 세션은 곧바로, 만료나 DB 에서 직접 끊은 세션은 다음 재확인 때 닫힌다.
 */
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

  /** 연결을 세션에 묶는다. 연결이 먼저 닫히면 돌려준 함수로 푼다. */
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

  /** 소켓을 묶고, 소켓이 끊기면 저절로 푼다. 확인하는 사이 이미 끊긴 소켓은 묶지 않는다. */
  bindSocket(sessionId: string, socket: DisconnectableSocket): void {
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

  /** 묶인 세션을 다시 확인해 끝난 세션의 연결을 닫는다. DB 오류인 세션은 다음 차례에 다시 본다. */
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
