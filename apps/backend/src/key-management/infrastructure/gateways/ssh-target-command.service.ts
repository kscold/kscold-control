import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { accessSync, constants, lstatSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import type {
  KeyManagementTarget,
  SshSecretStoreConfig,
} from '../../domain/types/key-management-target.type';
import { runProcess } from './process-runner';

interface SshCommandOptions {
  input?: string;
  timeoutMs?: number;
  maxOutputBytes?: number;
}

@Injectable()
export class SshTargetCommandService {
  private readonly sshPath: string;
  private readonly identityDirectory: string;

  constructor(config: ConfigService) {
    this.sshPath =
      config.get<string>('KEY_MANAGEMENT_SSH_PATH') ?? '/usr/bin/ssh';
    this.identityDirectory = path.resolve(
      config.get<string>('KEY_MANAGEMENT_SSH_IDENTITY_DIR') ??
        path.join(homedir(), '.ssh'),
    );
  }

  async execute(
    target: KeyManagementTarget,
    remoteCommand: string,
    options: SshCommandOptions = {},
  ): Promise<string> {
    if (target.provider !== 'ssh-env-file') {
      throw new ServiceUnavailableException(
        'SSH 키 관리 대상 설정이 올바르지 않습니다.',
      );
    }

    const connection = target.secretConfig as SshSecretStoreConfig;
    const identityFile = path.resolve(
      this.identityDirectory,
      `kscold-control-${connection.credentialRef}`,
    );
    if (path.dirname(identityFile) !== this.identityDirectory) {
      throw new ServiceUnavailableException(
        'SSH 인증서 참조 경로가 올바르지 않습니다.',
      );
    }

    try {
      accessSync(identityFile, constants.R_OK);
      const identityStat = lstatSync(identityFile);
      if (!identityStat.isFile() || (identityStat.mode & 0o077) !== 0) {
        throw new Error('unsafe identity file');
      }
      const { stdout } = await runProcess(
        this.sshPath,
        [
          '-i',
          identityFile,
          '-p',
          String(connection.port),
          '-o',
          'BatchMode=yes',
          '-o',
          'PasswordAuthentication=no',
          '-o',
          'KbdInteractiveAuthentication=no',
          '-o',
          'IdentitiesOnly=yes',
          '-o',
          'StrictHostKeyChecking=yes',
          '-o',
          'ConnectTimeout=10',
          '-o',
          'ServerAliveInterval=10',
          '-o',
          'ServerAliveCountMax=3',
          '-o',
          'LogLevel=ERROR',
          `${connection.username}@${connection.host}`,
          remoteCommand,
        ],
        options,
      );
      return stdout;
    } catch {
      throw new ServiceUnavailableException(
        'SSH 운영 서버 명령을 안전하게 실행하지 못했습니다.',
      );
    }
  }
}

export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}
