import { spawn, type ChildProcess } from 'node:child_process';
import { createWriteStream, mkdirSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';

export interface NodeProcessOptions {
  /** Electron 실행 파일. ELECTRON_RUN_AS_NODE 로 Node 처럼 쓴다. */
  nodeBinary: string;
  cwd: string;
  env: Record<string, string>;
  logFile: string;
}

function nodeEnv(env: Record<string, string>) {
  // 설치한 Node 없이 Electron 안의 Node 로 백엔드를 돌린다.
  return { ...process.env, ...env, ELECTRON_RUN_AS_NODE: '1' };
}

function openLog(logFile: string) {
  mkdirSync(path.dirname(logFile), { recursive: true });
  return createWriteStream(logFile, { flags: 'a' });
}

/** Node 스크립트를 끝까지 실행하고 실패하면 로그 끝부분을 담아 던진다. */
export function runNodeScript(script: string, args: string[], options: NodeProcessOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const log = openLog(options.logFile);
    const tail: string[] = [];
    const child = spawn(options.nodeBinary, [script, ...args], {
      cwd: options.cwd,
      env: nodeEnv(options.env),
      windowsHide: true,
    });
    const collect = (chunk: Buffer) => {
      log.write(chunk);
      tail.push(chunk.toString());
      if (tail.length > 20) tail.shift();
    };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    child.on('error', reject);
    child.on('close', (code) => {
      log.end();
      if (code === 0) resolve();
      else reject(new Error(`${path.basename(script)} 실패(코드 ${code}): ${tail.join('').slice(-600)}`));
    });
  });
}

/** 백엔드를 띄운다. 출력은 로그 파일로 보낸다. */
export function startBackend(mainScript: string, options: NodeProcessOptions): ChildProcess {
  const log = openLog(options.logFile);
  const child = spawn(options.nodeBinary, [mainScript], {
    cwd: options.cwd,
    env: nodeEnv(options.env),
    windowsHide: true,
  });
  child.stdout?.pipe(log);
  child.stderr?.pipe(log);
  return child;
}

/** 백엔드 상태 주소가 응답할 때까지 기다린다. */
export async function waitForHealth(
  port: number,
  timeoutMs = 90_000,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetchImpl(`http://127.0.0.1:${port}/api/health`);
      if (response.ok) return;
    } catch {
      // 아직 뜨는 중
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error('Control 서버가 제때 켜지지 않았습니다. 로그를 확인해 주세요.');
}

/** 이 컴퓨터에서 비어 있는 포트를 찾는다. */
export function findFreePort(preferred: number): Promise<number> {
  const tryPort = (port: number) =>
    new Promise<number | null>((resolve) => {
      const server = net.createServer();
      server.once('error', () => resolve(null));
      server.listen(port, '127.0.0.1', () => server.close(() => resolve(port)));
    });
  return (async () => {
    for (let port = preferred; port < preferred + 50; port += 1) {
      if ((await tryPort(port)) !== null) return port;
    }
    throw new Error(`${preferred} 근처에 빈 포트가 없습니다.`);
  })();
}
