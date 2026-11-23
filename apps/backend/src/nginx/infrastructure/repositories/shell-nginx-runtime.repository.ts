import { Injectable, Logger } from '@nestjs/common';
import { execFile } from 'child_process';
import { promisify } from 'util';
import type { INginxRuntimeRepository } from '../../domain/repositories/nginx-runtime.repository.interface';

import { resolveNginxContainer } from '../../../common/utils/nginx-container.util';

export { resolveNginxContainer };

const execFileAsync = promisify(execFile);

const DISABLED_OUTPUT =
  'nginx 연동이 꺼져 있습니다(NGINX_CONTAINER 가 비어 있음).';
// docker 가 멈춰 있어도 차단 반영 요청이 끝없이 쌓이지 않게 한다.
const EXEC_TIMEOUT_MS = 15_000;

@Injectable()
export class ShellNginxRuntimeRepository implements INginxRuntimeRepository {
  private readonly logger = new Logger(ShellNginxRuntimeRepository.name);

  private async execInNginx(args: string[]) {
    const container = resolveNginxContainer();
    if (!container) return null;
    // 셸을 거치지 않고 인자로 넘겨 윈도우에서도 같게 동작한다. nginx 는 결과를 stderr 로 쓴다.
    const { stdout, stderr } = await execFileAsync(
      'docker',
      ['exec', container, 'nginx', ...args],
      { timeout: EXEC_TIMEOUT_MS },
    );
    return stdout + stderr;
  }

  async testConfig(): Promise<{ success: boolean; output: string }> {
    try {
      const output = await this.execInNginx(['-t']);
      if (output === null) return { success: false, output: DISABLED_OUTPUT };
      return { success: true, output };
    } catch (error) {
      return { success: false, output: error.message };
    }
  }

  async reload(): Promise<{ success: boolean; output: string }> {
    try {
      const output = await this.execInNginx(['-s', 'reload']);
      if (output === null) return { success: false, output: DISABLED_OUTPUT };
      return { success: true, output };
    } catch (error) {
      return { success: false, output: error.message };
    }
  }

  async stop(): Promise<void> {
    const container = resolveNginxContainer();
    if (!container) throw new Error(DISABLED_OUTPUT);
    await execFileAsync('docker', ['stop', container], { timeout: 15000 });
  }

  async start(): Promise<void> {
    const container = resolveNginxContainer();
    if (!container) throw new Error(DISABLED_OUTPUT);
    await execFileAsync('docker', ['start', container], { timeout: 15000 });
  }
}
