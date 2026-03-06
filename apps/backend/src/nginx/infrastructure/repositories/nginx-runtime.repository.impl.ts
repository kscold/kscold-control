import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { INginxRuntimeRepository } from '../../domain/interfaces/nginx-runtime.repository';

const execAsync = promisify(exec);
const NGINX_CONTAINER = 'kscold-nginx';

@Injectable()
export class NginxRuntimeRepositoryImpl implements INginxRuntimeRepository {
  private readonly logger = new Logger(NginxRuntimeRepositoryImpl.name);

  async testConfig(): Promise<{ success: boolean; output: string }> {
    try {
      const { stdout, stderr } = await execAsync(
        `docker exec ${NGINX_CONTAINER} nginx -t 2>&1`,
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
