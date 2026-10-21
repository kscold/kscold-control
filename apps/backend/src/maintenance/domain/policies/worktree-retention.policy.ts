import type {
  WorktreeDecision,
  WorktreeInspection,
  WorktreeInspectionFailure,
  WorktreeKeepReason,
} from '../types/worktree.type';

/**
 * 작업 폴더 보존 규칙
 *
 * 작업 폴더를 지워도 잃는 것이 없을 때만 지운다.
 * - 최근에 손댄 N 개는 다시 쓸 가능성이 높아 남긴다.
 * - 실행 중인 프로세스가 있거나, 커밋하지 않은 변경·원격에 없는 커밋이 있으면 남긴다.
 * - 기준 브랜치에 아직 들어가지 않은 작업도 진행 중일 수 있어 기본으로 남긴다.
 * - 살펴보다 실패한 폴더는 상태를 모르므로 남긴다.
 * 지울 수 있는 것은 "원격에서 그대로 다시 받을 수 있는" 폴더뿐이다.
 */

export interface WorktreeRetentionOptions {
  /** 최근 작업 순으로 남길 개수 */
  keepRecent: number;
  /** 기준 브랜치에 들어가지 않은 작업 폴더를 남길지 */
  protectUnmerged: boolean;
}

export const DEFAULT_KEEP_RECENT = 3;

export const MAX_KEEP_RECENT = 100;

export function decideWorktreeRetention(
  inspections: WorktreeInspection[],
  failures: WorktreeInspectionFailure[],
  options: WorktreeRetentionOptions,
): WorktreeDecision[] {
  const byRecency = [...inspections].sort(
    (left, right) =>
      right.lastActivityAt.getTime() - left.lastActivityAt.getTime() ||
      left.name.localeCompare(right.name),
  );
  const recentNames = new Set(
    byRecency
      .slice(0, Math.max(0, options.keepRecent))
      .map((item) => item.name),
  );

  const decisions: WorktreeDecision[] = byRecency.map((item) => {
    const reasons: WorktreeKeepReason[] = [];
    if (recentNames.has(item.name)) reasons.push('recent');
    if (item.active) reasons.push('active-process');
    if (item.uncommittedCount > 0) reasons.push('uncommitted-changes');
    if (item.unpushedCount > 0) reasons.push('unpushed-commits');
    if (options.protectUnmerged && !item.merged) reasons.push('not-merged');

    return {
      name: item.name,
      path: item.path,
      branch: item.branch,
      lastActivityAt: item.lastActivityAt,
      sizeBytes: item.sizeBytes,
      action: reasons.length > 0 ? 'keep' : 'remove',
      reasons,
    };
  });

  for (const failure of failures) {
    decisions.push({
      name: failure.name,
      path: failure.path,
      branch: null,
      lastActivityAt: null,
      sizeBytes: 0,
      action: 'keep',
      reasons: ['inspection-failed'],
      detail: failure.message,
    });
  }

  return decisions;
}
