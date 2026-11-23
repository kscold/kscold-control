import { execFile } from 'node:child_process';
import {
  DATABASE_CONTAINER,
  DATABASE_NAME,
  DATABASE_USER,
  DATABASE_VOLUME,
  type DesktopConfig,
} from './config';

export interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

export type CommandRunner = (command: string, args: string[]) => Promise<CommandResult>;

/** 실패해도 던지지 않고 종료 코드를 돌려주는 명령 실행기 */
export const runCommand: CommandRunner = (command, args) =>
  new Promise((resolve) => {
    // 이미지 내려받기(docker run)는 오래 걸릴 수 있어 넉넉히, 상태 확인은 짧게 끊는다.
    const timeout = args[0] === 'run' ? 600_000 : 30_000;
    execFile(command, args, { timeout, windowsHide: true }, (error, stdout, stderr) => {
      const code =
        error && typeof (error as NodeJS.ErrnoException).code === 'number'
          ? ((error as NodeJS.ErrnoException).code as unknown as number)
          : error
            ? 1
            : 0;
      resolve({ code, stdout: String(stdout), stderr: String(stderr || error?.message || '') });
    });
  });

export type DockerState =
  | { state: 'ready'; version: string }
  | { state: 'not-installed' }
  | { state: 'not-running'; detail: string };

/** Docker 명령이 있는지, 엔진이 켜져 있는지 확인한다. */
export async function checkDocker(run: CommandRunner = runCommand): Promise<DockerState> {
  const client = await run('docker', ['--version']);
  if (client.code !== 0) return { state: 'not-installed' };
  const engine = await run('docker', ['info', '--format', '{{.ServerVersion}}']);
  if (engine.code !== 0 || !engine.stdout.trim()) {
    return { state: 'not-running', detail: engine.stderr.trim().split('\n')[0] ?? '' };
  }
  return { state: 'ready', version: engine.stdout.trim() };
}

/** 운영체제별 Docker 설치 안내 주소 */
export function dockerInstallUrl(platform: NodeJS.Platform): string {
  if (platform === 'linux') return 'https://docs.docker.com/engine/install/';
  return 'https://www.docker.com/products/docker-desktop/';
}

/**
 * 데이터베이스 컨테이너를 만들거나 다시 켠다.
 * 데이터는 이름 있는 볼륨에 남아 앱을 지웠다 깔아도 유지된다.
 */
export async function ensureDatabase(
  config: DesktopConfig,
  run: CommandRunner = runCommand,
): Promise<void> {
  const inspect = await run('docker', [
    'inspect',
    '--format',
    '{{.State.Running}}',
    DATABASE_CONTAINER,
  ]);
  if (inspect.code === 0) {
    if (inspect.stdout.trim() !== 'true') {
      const started = await run('docker', ['start', DATABASE_CONTAINER]);
      if (started.code !== 0) throw new Error(`데이터베이스를 켜지 못했습니다: ${started.stderr.trim()}`);
    }
    return;
  }

  const created = await run('docker', [
    'run',
    '-d',
    '--name',
    DATABASE_CONTAINER,
    '--restart',
    'unless-stopped',
    '-e',
    `POSTGRES_DB=${DATABASE_NAME}`,
    '-e',
    `POSTGRES_USER=${DATABASE_USER}`,
    '-e',
    `POSTGRES_PASSWORD=${config.secrets.databasePassword}`,
    // 데이터베이스는 이 컴퓨터 안에서만 열어 둔다.
    '-p',
    `127.0.0.1:${config.databasePort}:5432`,
    '-v',
    `${DATABASE_VOLUME}:/var/lib/postgresql/data`,
    'postgres:15-alpine',
  ]);
  if (created.code !== 0) {
    throw new Error(`데이터베이스를 만들지 못했습니다: ${created.stderr.trim()}`);
  }
}

/** 데이터베이스가 연결을 받을 때까지 기다린다. */
export async function waitForDatabase(
  run: CommandRunner = runCommand,
  attempts = 60,
  delayMs = 1_000,
): Promise<void> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const ready = await run('docker', [
      'exec',
      DATABASE_CONTAINER,
      'pg_isready',
      '-U',
      DATABASE_USER,
      '-d',
      DATABASE_NAME,
    ]);
    if (ready.code === 0) return;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error('데이터베이스가 제때 준비되지 않았습니다. Docker 상태를 확인해 주세요.');
}
