import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { INginxRuntimeRepository } from '../../domain/repositories/nginx-runtime.repository';

const execAsync = promisify(exec);
const NGINX_CONTAINER = 'kscold-nginx';
// docker 가 멈춰 있어도 차단 반영 요청이 끝없이 쌓이지 않게 한다.
const EXEC_TIMEOUT_MS = 15_000;

@Injectable()
export class NginxRuntimeRepositoryImpl implements INginxRuntimeRepository {
  private readonly logger = new Logger(NginxRuntimeRepositoryImpl.name);

  async testConfig(): Promise<{ success: boolean; output: string }> {
    try {
      const { stdout, stderr } = await execAsync(
        `docker exec ${NGINX_CONTAINER} nginx -t 2>&1`,
        { timeout: EXEC_TIMEOUT_MS },
      );
      const output = stdout + stderr;
      return { success: true, output };
    } catch (error) {
      return { success: false, output: error.message };
    }
  }

  async reload(): Promise<{ success: boolean; output: string }> {
    try {
      const { stdout, stderr } = await execAsync(
        `docker exec ${NGINX_CONTAINER} nginx -s reload 2>&1`,
        { timeout: EXEC_TIMEOUT_MS },
      );
      return { success: true, output: stdout + stderr };
    } catch (error) {
      return { success: false, output: error.message };
    }
  }

  async stop(): Promise<void> {
    await execAsync(`docker stop ${NGINX_CONTAINER}`, { timeout: 15000 });
  }

  async start(): Promise<void> {
    await execAsync(`docker start ${NGINX_CONTAINER}`, { timeout: 15000 });
  }
}
