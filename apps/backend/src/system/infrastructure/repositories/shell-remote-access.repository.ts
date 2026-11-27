import { Injectable } from '@nestjs/common';
import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { promisify } from 'util';

import type { IRemoteAccessRepository } from '../../domain/repositories/remote-access.repository.interface';
import {
  sshGuardPath,
  tailscalePath,
} from '../../domain/policies/remote-access.policy';
import type { RemoteAccessPath } from '../../domain/types/remote-access.type';

const execFileAsync = promisify(execFile);
const TIMEOUT = 5000;

/**
 * 맥마다 설치 방식이 달라 경로는 .env 로 받는다.
 * - TAILSCALE_SOCKET: 사용자 공간 tailscaled 소켓 (없으면 기본 소켓)
 * - TAILSCALE_BIN: tailscale 명령 (기본 tailscale)
 * - ORCA_APP_PROCESS: 폰 Orca 가 릴레이로 붙는 데스크톱 앱 실행 파일 경로 (없으면 이 항목을 뺌)
 * - SSH_AUDIT_DIR: 차단기 상태 파일 폴더 (기본 ~/server-watchdog)
 */
@Injectable()
export class ShellRemoteAccessRepository implements IRemoteAccessRepository {
  async probe(): Promise<RemoteAccessPath[]> {
    const paths = await Promise.all([
      this.tailscale(),
      this.orcaRelay(),
      this.sshGuard(),
    ]);
    return paths.filter((path): path is RemoteAccessPath => path !== null);
  }

  private async tailscale(): Promise<RemoteAccessPath> {
    const socket = process.env.TAILSCALE_SOCKET;
    const args = [
      ...(socket ? [`--socket=${socket}`] : []),
      'status',
      '--json',
    ];
    try {
      const { stdout } = await execFileAsync(
        process.env.TAILSCALE_BIN || 'tailscale',
        args,
        { timeout: TIMEOUT },
      );
      return tailscalePath(JSON.parse(stdout) as object);
    } catch (error) {
      return {
        id: 'tailscale',
        label: '테일스케일 SSH',
        state: 'down',
        detail: `상태를 읽지 못함 (${errorCode(error)})`,
      };
    }
  }

  private async orcaRelay(): Promise<RemoteAccessPath | null> {
    const app = process.env.ORCA_APP_PROCESS;
    if (!app) return null;
    const label = '폰 Orca 릴레이';
    try {
      // pgrep 은 찾지 못하면 1 로 끝난다. 그 밖의 실패는 확인 못 함으로 본다.
      await execFileAsync('pgrep', ['-f', `^${escapeRegex(app)}$`], {
        timeout: TIMEOUT,
      });
      return { id: 'orca-relay', label, state: 'ok', detail: '앱 실행 중' };
    } catch (error) {
      const notFound = (error as { code?: unknown }).code === 1;
      return {
        id: 'orca-relay',
        label,
        state: notFound ? 'down' : 'unknown',
        detail: notFound ? '데스크톱 앱이 꺼져 있음' : errorCode(error),
      };
    }
  }

  private async sshGuard(): Promise<RemoteAccessPath> {
    const dir = process.env.SSH_AUDIT_DIR || join(homedir(), 'server-watchdog');
    try {
      const raw = await fs.readFile(join(dir, 'ssh-guard-status.json'), 'utf8');
      return sshGuardPath(JSON.parse(raw) as object, new Date());
    } catch (error) {
      return {
        id: 'ssh-guard',
        label: 'SSH 차단기',
        state: 'unknown',
        detail: `상태 파일을 읽지 못함 (${errorCode(error)})`,
      };
    }
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function errorCode(error: unknown): string {
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' || typeof code === 'number'
    ? String(code)
    : error instanceof Error
      ? error.message.slice(0, 80)
      : 'unknown';
}
