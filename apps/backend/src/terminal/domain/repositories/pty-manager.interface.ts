import * as pty from 'node-pty';

/**
 * PTY 매니저 인터페이스
 * PTY 프로세스를 관리하는 도메인 인터페이스
 */
export interface IPtyManager {
  /**
   * 세션용 PTY 프로세스를 새로 생성한다
   */
  createPty(sessionId: string): pty.IPty;

  /**
   * 세션의 기존 PTY 프로세스를 가져온다
   */
  getPty(sessionId: string): pty.IPty | undefined;

  /**
   * 세션에 PTY가 존재하는지 확인한다
   */
  hasPty(sessionId: string): boolean;

  /**
   * 세션의 PTY 프로세스를 종료한다
   */
  killPty(sessionId: string): void;

  /**
   * PTY 프로세스에 데이터를 쓴다
   */
  write(sessionId: string, data: string): void;

  /**
   * PTY 터미널 크기를 조정한다
   */
  resize(sessionId: string, cols: number, rows: number): void;

  /**
   * 인터럽트 시그널(Ctrl+C)을 보낸다
   */
  interrupt(sessionId: string): void;
}
