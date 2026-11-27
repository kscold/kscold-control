import { Injectable, Logger } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import type { ISshAllowUsersGateway } from '../../domain/gateways/ssh-allow-users.gateway.interface';

@Injectable()
export class FileSshAllowUsersGateway implements ISshAllowUsersGateway {
  private readonly logger = new Logger(FileSshAllowUsersGateway.name);

  async read(): Promise<string | null> {
    const path = process.env.SSH_ALLOW_USERS_CONFIG;
    return path ? readFile(path, 'utf8') : null;
  }

  protectedRule(): string | null {
    if (
      !process.env.SSH_ALLOW_USERS_CONFIG ||
      !process.env.SSH_ALLOW_USERS_HELPER
    ) {
      return null;
    }
    return process.env.SSH_ALLOW_USERS_PROTECTED_RULE || null;
  }

  apply(
    revision: string,
    config: string,
  ): Promise<'applied' | 'conflict' | 'failed'> {
    const helper = process.env.SSH_ALLOW_USERS_HELPER;
    if (
      !helper ||
      !helper.startsWith('/') ||
      Buffer.byteLength(config) > 65_536
    ) {
      return Promise.resolve('failed');
    }
    return new Promise((resolve) => {
      const child = execFile(
        '/usr/bin/sudo',
        ['-n', '--', helper],
        {
          timeout: 10_000,
          maxBuffer: 16_384,
        },
        (error) => {
          if (!error) return resolve('applied');
          if (error.code === 75) return resolve('conflict');
          this.logger.warn(
            `SSH 허용 규칙 적용 도구 실패 (${error.code ?? 'unknown'})`,
          );
          resolve('failed');
        },
      );
      child.stdin?.on('error', (error) => {
        this.logger.warn(`SSH 허용 규칙 적용 요청 전달 실패: ${String(error)}`);
      });
      child.stdin?.end(`${revision}\n${config}`);
    });
  }
}
