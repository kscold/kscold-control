import { describe, expect, it } from 'vitest';
import { createConfig } from './config';
import { checkDocker, ensureDatabase, type CommandRunner } from './docker';

function runner(responses: Record<string, { code: number; stdout?: string; stderr?: string }>) {
  const calls: string[][] = [];
  const run: CommandRunner = async (_command, args) => {
    calls.push(args);
    const response = responses[args[0]] ?? { code: 0 };
    return { code: response.code, stdout: response.stdout ?? '', stderr: response.stderr ?? '' };
  };
  return { run, calls };
}

const config = createConfig(
  {
    adminEmail: 'admin@example.com',
    adminPassword: 'correct-horse-battery',
    port: 4000,
    dataDir: '/tmp/control',
    startAtLogin: false,
  },
  55432,
  (size) => Buffer.alloc(size, 1),
);

describe('Docker 확인', () => {
  it('명령이 없으면 설치되지 않은 것으로 본다', async () => {
    const { run } = runner({ '--version': { code: 1 } });
    expect(await checkDocker(run)).toEqual({ state: 'not-installed' });
  });

  it('엔진이 꺼져 있으면 꺼진 상태와 첫 줄 원인을 준다', async () => {
    const { run } = runner({ info: { code: 1, stderr: 'Cannot connect\nmore' } });
    expect(await checkDocker(run)).toEqual({ state: 'not-running', detail: 'Cannot connect' });
  });
});

describe('데이터베이스 준비', () => {
  it('컨테이너가 없으면 이 컴퓨터에서만 열리는 포트로 새로 만든다', async () => {
    const { run, calls } = runner({ inspect: { code: 1 } });
    await ensureDatabase(config, run);
    const created = calls.find((args) => args[0] === 'run')!;
    expect(created).toContain('127.0.0.1:55432:5432');
    expect(created).toContain('kscold-control-db-data:/var/lib/postgresql/data');
  });

  it('꺼진 컨테이너는 다시 켜기만 한다', async () => {
    const { run, calls } = runner({ inspect: { code: 0, stdout: 'false\n' } });
    await ensureDatabase(config, run);
    expect(calls.map((args) => args[0])).toEqual(['inspect', 'start']);
  });
});
