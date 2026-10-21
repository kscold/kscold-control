import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import type { WorktreeCleanupRun } from '../../domain/entities/worktree-cleanup-run.entity';
import type { WorktreeCleanupTarget } from '../../domain/entities/worktree-cleanup-target.entity';
import { decideWorktreeRetention } from '../../domain/policies/worktree-retention.policy';
import {
  WORKTREE_CLEANUP_RUN_REPOSITORY,
  type FinishWorktreeCleanupRunInput,
  type IWorktreeCleanupRunRepository,
} from '../../domain/repositories/worktree-cleanup-run.repository';
import {
  WORKTREE_CLEANUP_TARGET_REPOSITORY,
  type IWorktreeCleanupTargetRepository,
} from '../../domain/repositories/worktree-cleanup-target.repository';
import {
  WORKTREE_WORKSPACE_GATEWAY,
  type IWorktreeWorkspaceGateway,
} from '../../domain/repositories/worktree-workspace.gateway';
import type {
  RemovedWorktree,
  WorktreeCleanupActor,
  WorktreeCleanupTrigger,
  WorktreeDecision,
} from '../../domain/types/worktree.type';

const INTERRUPTED_RUN_MESSAGE =
  '서버가 다시 시작되어 정리가 중단됐습니다. 필요하면 다시 실행하세요.';

export interface WorktreeCleanupPlan {
  decisions: WorktreeDecision[];
  staleRepositories: string[];
}

/** 작업 폴더 정리 한 번의 순서(살펴보기 → 보존 규칙 → 백업 후 삭제 → 기록)를 맡는다. */
@Injectable()
export class WorktreeCleanupRunnerService implements OnModuleInit {
  private readonly logger = new Logger(WorktreeCleanupRunnerService.name);

  /** 같은 대상의 정리가 겹쳐 돌지 않게 막는 실행 중 표시 (대상 id) */
  private readonly running = new Set<string>();

  constructor(
    @Inject(WORKTREE_CLEANUP_TARGET_REPOSITORY)
    private readonly targetRepository: IWorktreeCleanupTargetRepository,
    @Inject(WORKTREE_CLEANUP_RUN_REPOSITORY)
    private readonly runRepository: IWorktreeCleanupRunRepository,
    @Inject(WORKTREE_WORKSPACE_GATEWAY)
    private readonly workspace: IWorktreeWorkspaceGateway,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      const closed = await this.runRepository.failUnfinished(
        INTERRUPTED_RUN_MESSAGE,
      );
      if (closed > 0) {
        this.logger.warn(
          `[작업 폴더 정리] 중단된 실행 기록 ${closed}건을 실패로 닫음`,
        );
      }
    } catch (error) {
      this.logger.error(
        `[작업 폴더 정리] 중단된 실행 기록 정리 실패: ${toMessage(error)}`,
      );
    }
  }

  isRunning(targetId: string): boolean {
    return this.running.has(targetId);
  }

  /** 지우지 않고 무엇을 남기고 지울지만 계산한다 (미리보기). */
  async plan(target: WorktreeCleanupTarget): Promise<WorktreeCleanupPlan> {
    const { decisions, scan } = await this.evaluate(target);
    return { decisions, staleRepositories: scan.staleRepositories };
  }

  private async evaluate(target: WorktreeCleanupTarget) {
    if (!(await this.workspace.rootExists(target.rootPath))) {
      throw new NotFoundException(`정리 루트가 없습니다: ${target.rootPath}`);
    }
    const scan = await this.workspace.scan(target.rootPath, target.baseRefs);
    const decisions = decideWorktreeRetention(scan.inspections, scan.failures, {
      keepRecent: target.keepRecent,
      protectUnmerged: target.protectUnmerged,
    });
    return { scan, decisions };
  }

  /** 정리를 시작하고 실행 기록만 먼저 돌려준다. 살펴보기·삭제는 뒤에서 이어진다. */
  async start(
    targetId: string,
    trigger: WorktreeCleanupTrigger,
    actor: WorktreeCleanupActor | null = null,
  ): Promise<WorktreeCleanupRun> {
    const { run } = await this.begin(targetId, trigger, actor);
    return run;
  }

  async runToCompletion(
    targetId: string,
    trigger: WorktreeCleanupTrigger,
  ): Promise<WorktreeCleanupRun> {
    const { completion } = await this.begin(targetId, trigger, null);
    return completion;
  }

  private async begin(
    targetId: string,
    trigger: WorktreeCleanupTrigger,
    actor: WorktreeCleanupActor | null,
  ) {
    const target = await this.targetRepository.findById(targetId);
    if (!target) {
      throw new NotFoundException('등록되지 않은 정리 대상입니다.');
    }
    if (this.running.has(target.id)) {
      throw new ConflictException('이미 정리가 진행 중입니다.');
    }

    this.running.add(target.id);
    let run: WorktreeCleanupRun;
    try {
      run = await this.runRepository.start({
        targetId: target.id,
        trigger,
        actor,
      });
    } catch (error) {
      this.running.delete(target.id);
      throw error;
    }

    this.logger.log(`[작업 폴더 정리] ${target.name}: 시작 (${trigger})`);
    const completion = this.execute(target, run).finally(() =>
      this.running.delete(target.id),
    );
    return { run, completion };
  }

  /** 다른 작업이 같은 디스크를 쓰고 있으면 오차가 생기지만, 폴더 크기 합보다는 실제에 가깝다. */
  private async measureFree(rootPath: string): Promise<number | null> {
    try {
      return await this.workspace.freeBytes(rootPath);
    } catch {
      return null;
    }
  }

  private async execute(
    target: WorktreeCleanupTarget,
    run: WorktreeCleanupRun,
  ): Promise<WorktreeCleanupRun> {
    let outcome: FinishWorktreeCleanupRunInput;

    try {
      const { decisions, scan } = await this.evaluate(target);
      const freeBefore = await this.measureFree(target.rootPath);
      const staleRepositories = scan.staleRepositories;
      const removed: RemovedWorktree[] = [];
      const failed: string[] = [];
      const kept = decisions
        .filter((decision) => decision.action === 'keep')
        .map((decision) => ({
          name: decision.name,
          reasons: decision.reasons,
        }));

      const inspectionByName = new Map(
        scan.inspections.map((item) => [item.name, item]),
      );

      // 하나씩 지운다. 하나가 실패해도 나머지는 계속한다.
      for (const decision of decisions.filter(
        (item) => item.action === 'remove',
      )) {
        const inspection = inspectionByName.get(decision.name);
        if (!inspection) continue;
        try {
          removed.push(
            await this.workspace.remove({
              targetName: target.name,
              inspection,
              baseRefs: target.baseRefs,
            }),
          );
        } catch (error) {
          failed.push(`${decision.name}: ${toMessage(error)}`);
          kept.push({ name: decision.name, reasons: ['inspection-failed'] });
        }
      }

      const freedBytes = removed.reduce((sum, item) => sum + item.sizeBytes, 0);
      const freeAfter = await this.measureFree(target.rootPath);
      const diskReclaimedBytes =
        freeBefore !== null && freeAfter !== null
          ? Math.max(0, freeAfter - freeBefore)
          : null;
      const notes = [
        removed.length > 0
          ? `작업 폴더 ${removed.length}개를 정리했습니다 (폴더 크기 합 ${formatGiB(freedBytes)}${
              diskReclaimedBytes !== null
                ? `, 실제로 늘어난 여유 공간 ${formatGiB(diskReclaimedBytes)}`
                : ''
            }).`
          : '지울 수 있는 작업 폴더가 없었습니다.',
        `${kept.length}개는 남겼습니다.`,
      ];
      if (staleRepositories.length > 0) {
        notes.push(
          `원격 상태를 새로 받지 못한 저장소 ${staleRepositories.length}개는 예전 상태로 판단했습니다.`,
        );
      }
      if (failed.length > 0) {
        notes.push(`지우지 못한 폴더: ${failed.join(' / ')}`.slice(0, 1500));
      }

      outcome = {
        status: 'success',
        message: notes.join(' '),
        removed,
        kept,
        freedBytes,
        diskReclaimedBytes,
      };
      this.logger.log(`[작업 폴더 정리] ${target.name}: ${outcome.message}`);
    } catch (error) {
      outcome = {
        status: 'failed',
        message: `정리 실패: ${toMessage(error)}`,
        removed: [],
        kept: [],
        freedBytes: 0,
        diskReclaimedBytes: null,
      };
      this.logger.error(`[작업 폴더 정리] ${target.name}: ${outcome.message}`);
    }

    try {
      return await this.runRepository.finish(run.id, outcome);
    } catch (error) {
      this.logger.warn(
        `[작업 폴더 정리] 실행 결과 저장 실패 — ${toMessage(error)}`,
      );
      return { ...run, ...outcome, finishedAt: new Date() };
    }
  }
}

function formatGiB(bytes: number): string {
  return `${(bytes / 1024 ** 3).toFixed(1)}GiB`;
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
