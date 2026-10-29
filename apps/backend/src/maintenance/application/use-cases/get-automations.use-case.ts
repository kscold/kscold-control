import { Inject, Injectable } from '@nestjs/common';
import {
  describeLaunchdSchedule,
  launchdHealth,
  summarizeReleaseDir,
} from '../../domain/policies/automation.policy';
import {
  AUTOMATION_INSPECTION_GATEWAY,
  type IAutomationInspectionGateway,
} from '../../domain/repositories/automation-inspection.gateway';
import {
  STORAGE_TRIM_RUN_REPOSITORY,
  type IStorageTrimRunRepository,
} from '../../domain/repositories/storage-trim-run.repository';
import type { StorageTrimRun } from '../../domain/entities/storage-trim-run.entity';
import type {
  AutomationHealth,
  AutomationJob,
  ReleaseDirConfig,
} from '../../domain/types/automation.type';
import { storageTrimSchedule } from '../services/storage-trim-scheduler.service';
import { GetWorktreeCleanupOverviewUseCase } from './get-worktree-cleanup-overview.use-case';

export interface AutomationsOverview {
  generatedAt: Date;
  jobs: AutomationJob[];
  trimRuns: StorageTrimRun[];
  warnings: string[];
}

interface AutomationSettings {
  launchdPrefixes: string[];
  descriptions: Record<string, { name?: string; description?: string }>;
  releaseDirs: ReleaseDirConfig[];
}

function parseJson<T>(value: string | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

/**
 * 이 맥에 맞춘 설정 — 오픈소스 기본값은 비어 있고 운영 .env 로 채운다.
 * AUTOMATION_LAUNCHD_PREFIXES: 보여줄 launchd 등록 이름 앞부분 (쉼표로 구분)
 * AUTOMATION_DESCRIPTIONS: {"등록 이름": "설명"} 또는 {"등록 이름": {"name": "이름", "description": "설명"}}
 * AUTOMATION_RELEASE_DIRS: [{"label","container","path","keep","stateFile"}]
 */
export function automationSettings(
  env: NodeJS.ProcessEnv = process.env,
): AutomationSettings {
  const rawDescriptions = parseJson<
    Record<string, string | { name?: string; description?: string }>
  >(env.AUTOMATION_DESCRIPTIONS, {});
  const descriptions = Object.fromEntries(
    Object.entries(rawDescriptions).map(([label, value]) => [
      label,
      typeof value === 'string' ? { description: value } : value,
    ]),
  );
  const releaseDirs = parseJson<ReleaseDirConfig[]>(
    env.AUTOMATION_RELEASE_DIRS,
    [],
  ).filter(
    (config) =>
      config?.label &&
      config.container &&
      config.path &&
      Number.isInteger(config.keep),
  );
  return {
    launchdPrefixes: (env.AUTOMATION_LAUNCHD_PREFIXES ?? '')
      .split(',')
      .map((prefix) => prefix.trim())
      .filter(Boolean),
    descriptions,
    releaseDirs,
  };
}

function formatSize(bytes: number): string {
  return bytes >= 1024 ** 3
    ? `${(bytes / 1024 ** 3).toFixed(1)} GiB`
    : `${Math.round(bytes / 1024 ** 2)} MiB`;
}

function runHealth(status: string | undefined): AutomationHealth {
  if (status === 'running') return 'running';
  if (status === 'failed') return 'failed';
  if (status === 'success' || status === 'succeeded') return 'ok';
  return 'unknown';
}

/**
 * 자동 작업 현황 — Control 안 예약 작업, 맥 launchd 작업, 컨테이너 안 자동 정리를 한 목록으로 보여준다.
 * 한 묶음을 못 읽어도 나머지는 보여주고 이유는 warnings 에 담는다.
 */
@Injectable()
export class GetAutomationsUseCase {
  constructor(
    @Inject(AUTOMATION_INSPECTION_GATEWAY)
    private readonly gateway: IAutomationInspectionGateway,
    @Inject(STORAGE_TRIM_RUN_REPOSITORY)
    private readonly trimRuns: IStorageTrimRunRepository,
    private readonly worktreeOverview: GetWorktreeCleanupOverviewUseCase,
  ) {}

  async execute(
    settings: AutomationSettings = automationSettings(),
  ): Promise<AutomationsOverview> {
    const warnings: string[] = [];
    const attempt = async <T>(
      label: string,
      task: () => Promise<T>,
      fallback: T,
    ) => {
      try {
        return await task();
      } catch (error) {
        warnings.push(
          `${label}: ${error instanceof Error ? error.message : String(error)}`,
        );
        return fallback;
      }
    };

    const [worktrees, trimRuns, launchdJobs, releaseJobs] = await Promise.all([
      attempt('작업 폴더 정리', () => this.worktreeOverview.execute(), {
        items: [],
        timeZone: '',
      }),
      attempt('공간 반환 기록', () => this.trimRuns.listRecent(5), []),
      attempt(
        '맥 자동 실행 작업',
        () => this.gateway.listLaunchdJobs(settings.launchdPrefixes),
        [],
      ),
      Promise.all(
        settings.releaseDirs.map((config) =>
          attempt(config.label, () => this.releaseJob(config), null),
        ),
      ),
    ]);

    const trim = storageTrimSchedule();
    const latestTrim = trimRuns[0];
    const jobs: AutomationJob[] = [
      ...worktrees.items.map(({ target, running, lastRun }): AutomationJob => ({
        key: `worktree:${target.id}`,
        kind: 'control',
        name: `작업 폴더 정리 · ${target.name}`,
        description: target.description || target.rootPath,
        schedule: target.enabled ? `매일 ${target.scheduleTime}` : '일시 중지',
        health: running
          ? 'running'
          : target.enabled
            ? runHealth(lastRun?.status)
            : 'stopped',
        lastRunAt: lastRun?.startedAt ?? null,
        lastMessage: lastRun?.message || null,
      })),
      {
        key: 'storage-trim',
        kind: 'control',
        name: '도커 VM 공간 반환',
        description:
          'VM 안에서 지운 공간을 맥에 돌려줌 (fstrim, 서비스 중단 없음)',
        schedule: trim.enabled
          ? `매일 ${trim.scheduleTime}`
          : '자동 실행 꺼짐 (버튼으로만)',
        health: latestTrim
          ? runHealth(latestTrim.status)
          : trim.enabled
            ? 'unknown'
            : 'stopped',
        lastRunAt: latestTrim?.startedAt ?? null,
        lastMessage: latestTrim?.message || null,
      },
      ...launchdJobs.map((info): AutomationJob => {
        const text = settings.descriptions[info.label] ?? {};
        const health = launchdHealth(info);
        const exit =
          health === 'failed' && info.lastExitCode !== null
            ? `마지막 종료 코드 ${info.lastExitCode}`
            : null;
        return {
          key: `launchd:${info.label}`,
          kind: 'launchd',
          name: text.name ?? info.label,
          description: text.description ?? info.program,
          schedule: describeLaunchdSchedule(info.schedule),
          health,
          lastRunAt: info.logUpdatedAt,
          lastMessage:
            [exit, info.lastLogLine].filter(Boolean).join(' · ') || null,
        };
      }),
      ...releaseJobs.filter((job): job is AutomationJob => job !== null),
    ];

    return { generatedAt: new Date(), jobs, trimRuns, warnings };
  }

  private async releaseJob(config: ReleaseDirConfig): Promise<AutomationJob> {
    const info = await this.gateway.inspectReleaseDir(config);
    const summary = summarizeReleaseDir(config, info, formatSize);
    return {
      key: `release:${config.container}:${config.path}`,
      kind: 'container',
      name: config.label,
      description: `${config.container} 안 ${config.path}`,
      schedule: '배포가 성공할 때마다',
      health: summary.health,
      lastRunAt: info.lastDeployedAt,
      lastMessage: summary.message,
    };
  }
}
