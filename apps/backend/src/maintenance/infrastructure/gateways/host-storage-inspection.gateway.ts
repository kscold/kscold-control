import { Injectable } from '@nestjs/common';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { resolveDockerHost } from '../../../common/utils/docker-host.util';
import {
  parseDfUsedBytes,
  sumDeletedOpenFiles,
  toDockerUsageSnapshot,
  type DockerSystemDfJson,
} from '../../domain/policies/storage.policy';
import type { IStorageInspectionGateway } from '../../domain/repositories/storage-inspection.gateway';
import type {
  DiskUsage,
  DockerUsageSnapshot,
} from '../../domain/types/storage.type';

const execFileAsync = promisify(execFile);

/** PM2로 띄우면 PATH가 짧아 Homebrew 도구(colima·limactl)를 못 찾으므로 흔한 경로를 덧붙인다 */
const TOOL_PATH = [
  '/opt/homebrew/bin',
  '/usr/local/bin',
  '/usr/bin',
  '/bin',
  '/usr/sbin',
  '/sbin',
].join(':');
/** macOS Virtualization 프레임워크로 뜬 VM 프로세스 이름 */
const VM_PROCESS_PATTERN = 'com.apple.Virtualization.VirtualMachine';
const DOCKER_DATA_PATH = '/var/lib/docker';

interface CommandError extends Error {
  code?: number | string;
  killed?: boolean;
  stdout?: string;
}

/**
 * 맥 호스트에서 저장공간을 재는 게이트웨이.
 * 셸을 거치지 않도록 execFile만 쓰고, 공간을 바꾸는 명령은 fstrim 하나뿐이다.
 */
@Injectable()
export class HostStorageInspectionGateway implements IStorageInspectionGateway {
  private readonly dataDiskPath =
    process.env.COLIMA_DATA_DISK ??
    path.join(os.homedir(), '.colima/_lima/_disks/colima/datadisk');
  private readonly colimaBin = process.env.COLIMA_BIN ?? 'colima';
  private readonly hostVolume =
    process.env.STORAGE_HOST_VOLUME ?? '/System/Volumes/Data';

  async hostDisk(): Promise<DiskUsage> {
    const target = fs.existsSync(this.hostVolume) ? this.hostVolume : '/';
    const stats = await fs.promises.statfs(target);
    const totalBytes = stats.blocks * stats.bsize;
    const freeBytes = stats.bavail * stats.bsize;
    return { totalBytes, freeBytes, usedBytes: totalBytes - freeBytes };
  }

  dockerVmDiskPath(): string {
    return this.dataDiskPath;
  }

  async dockerVmAllocatedBytes(): Promise<number> {
    // 디스크 파일은 성긴(sparse) 파일이라 논리 크기가 아닌 실제 할당 블록으로 잰다
    const stats = await fs.promises.stat(this.dataDiskPath);
    return stats.blocks * 512;
  }

  async dockerVmUsedBytes(): Promise<number | null> {
    const output = await this.run(
      this.colimaBin,
      ['ssh', '--', 'df', '-B1', '--output=size,used,avail', DOCKER_DATA_PATH],
      20_000,
    );
    return parseDfUsedBytes(output);
  }

  async heldDeletedFiles(): Promise<{ bytes: number; files: number }> {
    const pids = (await this.run('pgrep', ['-f', VM_PROCESS_PATTERN], 10_000))
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => /^\d+$/.test(line));
    if (pids.length === 0) return { bytes: 0, files: 0 };
    const output = await this.run(
      'lsof',
      ['-a', '-nP', '-p', pids.join(','), '+L1', '-F', 'fts'],
      20_000,
    );
    return sumDeletedOpenFiles(output);
  }

  async dockerUsage(): Promise<DockerUsageSnapshot> {
    const output = await this.run(
      'docker',
      ['system', 'df', '-v', '--format', '{{json .}}'],
      60_000,
    );
    return toDockerUsageSnapshot(JSON.parse(output) as DockerSystemDfJson);
  }

  async folderSize(folderPath: string): Promise<number | null> {
    if (!fs.existsSync(folderPath)) return null;
    // 일부 하위 폴더를 못 읽어도 du는 합계를 출력하므로 첫 숫자를 그대로 쓴다
    const output = await this.run('du', ['-sk', folderPath], 120_000);
    const kib = Number(output.trim().split(/\s+/)[0]);
    return Number.isFinite(kib) ? kib * 1024 : null;
  }

  async trimDockerDisk(): Promise<string> {
    return this.run(
      this.colimaBin,
      ['ssh', '--', 'sudo', 'fstrim', '-v', DOCKER_DATA_PATH],
      180_000,
    );
  }

  /**
   * 명령을 셸 없이 실행한다. pgrep·lsof·du는 찾은 것이 없거나 일부를 못 읽으면
   * 0이 아닌 코드로 끝나도 표준 출력은 남기므로, 출력이 있으면 그대로 쓴다.
   */
  private async run(
    command: string,
    args: string[],
    timeout: number,
  ): Promise<string> {
    try {
      const { stdout } = await execFileAsync(command, args, {
        timeout,
        maxBuffer: 20 * 1024 * 1024,
        env: {
          ...process.env,
          PATH: `${process.env.PATH ?? ''}:${TOOL_PATH}`,
          DOCKER_HOST: resolveDockerHost(),
        },
      });
      return stdout;
    } catch (error) {
      const failed = error as CommandError;
      // 시간 초과로 끊긴 출력은 중간까지만 담겨 있어 크기를 잘못 보여주므로 버린다
      if (failed.killed) {
        throw new Error(`${command} 시간 초과`, { cause: error });
      }
      if (failed.stdout) return failed.stdout;
      if ((command === 'pgrep' || command === 'lsof') && failed.code === 1) {
        return '';
      }
      throw new Error(`${command} ${args[0] ?? ''} 실패: ${failed.message}`, {
        cause: error,
      });
    }
  }
}
