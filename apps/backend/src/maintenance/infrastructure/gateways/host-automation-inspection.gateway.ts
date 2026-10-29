import { Injectable } from '@nestjs/common';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { resolveDockerHost } from '../../../common/utils/docker-host.util';
import {
  lastMeaningfulLine,
  parseLaunchctlPrint,
} from '../../domain/policies/automation.policy';
import type { IAutomationInspectionGateway } from '../../domain/repositories/automation-inspection.gateway';
import type {
  LaunchdJobInfo,
  LaunchdSchedule,
  ReleaseDirConfig,
  ReleaseDirInfo,
} from '../../domain/types/automation.type';

const execFileAsync = promisify(execFile);
const TOOL_PATH =
  '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin';
const LOG_TAIL_BYTES = 4096;
const SCRIPT_EXTENSIONS = /\.(sh|mjs|cjs|js|py|rb)$/;

/** launchd 등록 파일(plist)에서 쓰는 키 */
interface LaunchdPlist {
  Label?: string;
  Program?: string;
  ProgramArguments?: string[];
  StartCalendarInterval?:
    Record<string, number> | Array<Record<string, number>>;
  StartInterval?: number;
  RunAtLoad?: boolean;
  KeepAlive?: boolean | Record<string, unknown>;
  LaunchOnlyOnce?: boolean;
  StandardOutPath?: string;
}

/** 컨테이너 안에서 폴더 개수·크기와 상태 파일을 한 번에 읽는 스크립트 (경로는 인자로만 넘김) */
const RELEASE_DIR_SCRIPT =
  'cd "$1" 2>/dev/null || exit 3; ' +
  'echo "$(find . -mindepth 1 -maxdepth 1 -type d | wc -l) $(du -sk . | cut -f1)"; ' +
  '[ -n "$2" ] && cat "$2" 2>/dev/null; exit 0';

/**
 * 맥 호스트에서 자동 작업 상태를 읽는 게이트웨이.
 * launchd 작업은 등록 파일·launchctl print·출력 기록으로, 릴리스 폴더는 docker exec 로 읽는다.
 */
@Injectable()
export class HostAutomationInspectionGateway implements IAutomationInspectionGateway {
  async listLaunchdJobs(prefixes: string[]): Promise<LaunchdJobInfo[]> {
    if (prefixes.length === 0) return [];
    const sources: Array<{ dir: string; domain: 'gui' | 'system' }> = [
      { dir: path.join(os.homedir(), 'Library/LaunchAgents'), domain: 'gui' },
      { dir: '/Library/LaunchDaemons', domain: 'system' },
    ];
    const jobs: LaunchdJobInfo[] = [];
    for (const source of sources) {
      const files = await fs.promises.readdir(source.dir).catch(() => []);
      for (const file of files.filter((name) => name.endsWith('.plist'))) {
        const plist = await this.readPlist(path.join(source.dir, file));
        const label = plist?.Label;
        if (!label || !prefixes.some((prefix) => label.startsWith(prefix))) {
          continue;
        }
        jobs.push(await this.inspectJob(label, source.domain, plist));
      }
    }
    return jobs.sort((left, right) => left.label.localeCompare(right.label));
  }

  async inspectReleaseDir(config: ReleaseDirConfig): Promise<ReleaseDirInfo> {
    const { stdout } = await execFileAsync(
      'docker',
      [
        'exec',
        config.container,
        'sh',
        '-c',
        RELEASE_DIR_SCRIPT,
        'sh',
        config.path,
        config.stateFile ?? '',
      ],
      {
        timeout: 60_000,
        env: {
          ...process.env,
          PATH: `${process.env.PATH ?? ''}:${TOOL_PATH}`,
          DOCKER_HOST: resolveDockerHost(),
        },
      },
    );
    const [summary, ...rest] = stdout.split('\n');
    const [count, kib] = summary.trim().split(/\s+/).map(Number);
    let lastDeployedAt: Date | null = null;
    try {
      const state = JSON.parse(rest.join('\n')) as { deployedAt?: string };
      lastDeployedAt = state.deployedAt ? new Date(state.deployedAt) : null;
    } catch {
      // 상태 파일이 없거나 JSON 이 아니면 마지막 배포 시각만 비운다
    }
    return {
      count: Number.isFinite(count) ? count : 0,
      sizeBytes: Number.isFinite(kib) ? kib * 1024 : 0,
      lastDeployedAt,
    };
  }

  private async readPlist(file: string): Promise<LaunchdPlist | null> {
    try {
      const { stdout } = await execFileAsync(
        'plutil',
        ['-convert', 'json', '-o', '-', file],
        { timeout: 10_000 },
      );
      return JSON.parse(stdout) as LaunchdPlist;
    } catch {
      return null;
    }
  }

  private async inspectJob(
    label: string,
    domain: 'gui' | 'system',
    plist: LaunchdPlist,
  ): Promise<LaunchdJobInfo> {
    const target =
      domain === 'gui'
        ? `gui/${process.getuid?.() ?? 501}/${label}`
        : `system/${label}`;
    let loaded = false;
    let status = { running: false, lastExitCode: null as number | null };
    try {
      const { stdout } = await execFileAsync('launchctl', ['print', target], {
        timeout: 10_000,
      });
      loaded = true;
      status = parseLaunchctlPrint(stdout);
    } catch {
      // 등록 파일은 있지만 지금 launchd 에 올라와 있지 않다
    }
    const log = await this.readLogTail(plist.StandardOutPath);
    return {
      label,
      domain,
      program: this.programName(plist),
      schedule: this.schedule(plist),
      loaded,
      running: status.running,
      lastExitCode: status.lastExitCode,
      logUpdatedAt: log?.updatedAt ?? null,
      lastLogLine: log?.line ?? null,
    };
  }

  private programName(plist: LaunchdPlist): string {
    const args = plist.ProgramArguments ?? [];
    const script = [...args]
      .reverse()
      .find((arg) => SCRIPT_EXTENSIONS.test(arg));
    const target = script ?? plist.Program ?? args[0] ?? '';
    // 셸로 감싼 명령은 앞부분 실행 파일 이름만 보여준다
    return path.basename(target.split(' ')[0] ?? target);
  }

  private schedule(plist: LaunchdPlist): LaunchdSchedule {
    const calendar = plist.StartCalendarInterval;
    return {
      calendar: (Array.isArray(calendar)
        ? calendar
        : calendar
          ? [calendar]
          : []
      ).map((entry) => ({
        hour: entry.Hour,
        minute: entry.Minute,
        weekday: entry.Weekday,
      })),
      intervalSeconds: plist.StartInterval ?? null,
      runAtLoad: plist.RunAtLoad === true,
      keepAlive:
        plist.KeepAlive === true || typeof plist.KeepAlive === 'object',
      launchOnlyOnce: plist.LaunchOnlyOnce === true,
    };
  }

  private async readLogTail(
    logPath: string | undefined,
  ): Promise<{ updatedAt: Date; line: string | null } | null> {
    if (!logPath) return null;
    try {
      const stats = await fs.promises.stat(logPath);
      const handle = await fs.promises.open(logPath, 'r');
      try {
        const length = Math.min(stats.size, LOG_TAIL_BYTES);
        const buffer = Buffer.alloc(length);
        await handle.read(buffer, 0, length, stats.size - length);
        return {
          updatedAt: stats.mtime,
          line: lastMeaningfulLine(buffer.toString('utf8')),
        };
      } finally {
        await handle.close();
      }
    } catch {
      return null;
    }
  }
}
