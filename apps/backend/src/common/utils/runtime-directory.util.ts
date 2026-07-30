import process from 'node:process';

/**
 * HOME 환경변수가 비어 있을 때 사용하는 폴백 홈 디렉토리.
 * PM2/launchd 로 띄우면 HOME 이 전달되지 않는 경우가 있어 폴백이 필요하다.
 */
export const DEFAULT_HOME_DIRECTORY = '/Users/kscold';

/**
 * 백엔드 프로세스가 기준으로 삼는 홈 디렉토리.
 */
export function getHomeDirectory(): string {
  return process.env.HOME || DEFAULT_HOME_DIRECTORY;
}

/**
 * 터미널 PTY / Claude 프로세스가 실행될 작업 디렉토리.
 * CLAUDE_WORKING_DIR 이 지정돼 있으면 그 값을, 없으면 홈 디렉토리를 쓴다.
 */
export function getWorkingDirectory(): string {
  return process.env.CLAUDE_WORKING_DIR || getHomeDirectory();
}
