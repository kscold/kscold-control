import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

/** 받은 환경 변수를 파일로 남기고 끝나는 가짜 에이전트 CLI 를 만든다. */
export function createFakeAgentCli() {
  const dir = mkdtempSync(path.join(tmpdir(), 'fake-agent-'));
  const binary = path.join(dir, 'agent');
  const report = path.join(dir, 'env.json');
  writeFileSync(
    binary,
    `#!${process.execPath}\nrequire('node:fs').writeFileSync(${JSON.stringify(report)}, JSON.stringify(process.env));\n`,
  );
  chmodSync(binary, 0o755);
  return {
    binary,
    readEnv: (): Record<string, string> =>
      JSON.parse(readFileSync(report, 'utf8')),
  };
}

export function waitForExit(
  run: (onEvent: (event: { type: string }) => void) => void,
) {
  return new Promise<void>((resolve) => {
    run((event) => {
      if (event.type === 'process-exit') resolve();
    });
  });
}
