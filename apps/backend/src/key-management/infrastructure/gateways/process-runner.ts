import { spawn } from 'child_process';

interface ProcessResult {
  stdout: string;
}

export function runProcess(
  executable: string,
  args: string[],
  options: { input?: string; timeoutMs?: number; maxOutputBytes?: number } = {},
): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      env: {
        ...process.env,
        CLOUDSDK_CORE_DISABLE_PROMPTS: '1',
        GH_PROMPT_DISABLED: '1',
      },
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const stdoutChunks: Buffer[] = [];
    let stdoutBytes = 0;
    let settled = false;
    const maxOutputBytes = options.maxOutputBytes ?? 512 * 1024;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGKILL');
      reject(new Error('외부 서비스 명령 시간이 초과되었습니다.'));
    }, options.timeoutMs ?? 30_000);

    child.stdout.on('data', (chunk: Buffer) => {
      stdoutBytes += chunk.length;
      if (stdoutBytes > maxOutputBytes) {
        if (!settled) {
          settled = true;
          child.kill('SIGKILL');
          clearTimeout(timeout);
          reject(new Error('외부 서비스 응답 크기가 제한을 초과했습니다.'));
        }
        return;
      }
      stdoutChunks.push(chunk);
    });

    // stderr는 비밀값이 섞일 가능성을 없애기 위해 수집하거나 반환하지 않는다.
    child.stderr.resume();

    child.once('error', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(new Error('외부 서비스 명령을 시작하지 못했습니다.'));
    });

    child.once('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (code !== 0) {
        reject(new Error(`외부 서비스 명령이 실패했습니다. exit=${code}`));
        return;
      }
      resolve({ stdout: Buffer.concat(stdoutChunks).toString('utf8') });
    });

    if (options.input !== undefined) {
      child.stdin.end(options.input, 'utf8');
    } else {
      child.stdin.end();
    }
  });
}
