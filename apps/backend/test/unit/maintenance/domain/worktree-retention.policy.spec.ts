import { decideWorktreeRetention } from '@/maintenance/domain/policies/worktree-retention.policy';
import type { WorktreeInspection } from '@/maintenance/domain/types/worktree.type';

function worktree(
  name: string,
  daysAgo: number,
  overrides: Partial<WorktreeInspection> = {},
): WorktreeInspection {
  return {
    name,
    path: `/root/${name}`,
    repositoryPath: '/repo',
    branch: `feature/${name}`,
    headSha: 'a'.repeat(40),
    lastActivityAt: new Date(Date.UTC(2026, 9, 21) - daysAgo * 86_400_000),
    uncommittedCount: 0,
    unpushedCount: 0,
    merged: true,
    active: false,
    sizeBytes: 1000,
    ...overrides,
  };
}

const options = { keepRecent: 3, protectUnmerged: true };
const actionOf = (
  decisions: ReturnType<typeof decideWorktreeRetention>,
  name: string,
) => decisions.find((decision) => decision.name === name);

describe('작업 폴더 보존 규칙', () => {
  it('최근에 손댄 3개를 남기고, 잃을 것이 없는 나머지는 지운다', () => {
    const decisions = decideWorktreeRetention(
      [1, 2, 3, 4, 5].map((day) => worktree(`w${day}`, day)),
      [],
      options,
    );

    expect(
      decisions.filter((d) => d.action === 'keep').map((d) => d.name),
    ).toEqual(['w1', 'w2', 'w3']);
    expect(
      decisions.filter((d) => d.action === 'remove').map((d) => d.name),
    ).toEqual(['w4', 'w5']);
    expect(actionOf(decisions, 'w1')?.reasons).toEqual(['recent']);
  });

  it.each([
    ['실행 중인 프로세스', { active: true }, 'active-process'],
    ['커밋하지 않은 변경', { uncommittedCount: 2 }, 'uncommitted-changes'],
    ['원격에 없는 커밋', { unpushedCount: 1 }, 'unpushed-commits'],
    ['기준 브랜치에 들어가지 않은 작업', { merged: false }, 'not-merged'],
  ])('오래됐어도 %s 이 있으면 남긴다', (_label, overrides, reason) => {
    const decisions = decideWorktreeRetention(
      [worktree('old', 30, overrides as Partial<WorktreeInspection>)],
      [],
      { keepRecent: 0, protectUnmerged: true },
    );

    expect(decisions[0]).toMatchObject({ action: 'keep', reasons: [reason] });
  });

  it('기준 브랜치 보호를 끄면 원격에 올라가 있는 미병합 작업은 지운다', () => {
    const decisions = decideWorktreeRetention(
      [worktree('old', 30, { merged: false })],
      [],
      {
        keepRecent: 0,
        protectUnmerged: false,
      },
    );

    expect(decisions[0].action).toBe('remove');
  });

  it('보호를 꺼도 원격에 없는 커밋은 남긴다', () => {
    const decisions = decideWorktreeRetention(
      [worktree('old', 30, { merged: false, unpushedCount: 3 })],
      [],
      { keepRecent: 0, protectUnmerged: false },
    );

    expect(decisions[0]).toMatchObject({
      action: 'keep',
      reasons: ['unpushed-commits'],
    });
  });

  it('살펴보다 실패한 폴더는 상태를 모르므로 남긴다', () => {
    const decisions = decideWorktreeRetention(
      [],
      [{ name: 'broken', path: '/root/broken', message: 'git 오류' }],
      options,
    );

    expect(decisions).toEqual([
      expect.objectContaining({
        name: 'broken',
        action: 'keep',
        reasons: ['inspection-failed'],
        detail: 'git 오류',
      }),
    ]);
  });

  it('남길 이유가 여러 개면 모두 적는다', () => {
    const decisions = decideWorktreeRetention(
      [worktree('busy', 1, { active: true, uncommittedCount: 1 })],
      [],
      options,
    );

    expect(decisions[0].reasons).toEqual([
      'recent',
      'active-process',
      'uncommitted-changes',
    ]);
  });

  it('최근 보존 개수가 0 이면 시각과 상관없이 규칙만 본다', () => {
    const decisions = decideWorktreeRetention([worktree('fresh', 0)], [], {
      keepRecent: 0,
      protectUnmerged: true,
    });

    expect(decisions[0].action).toBe('remove');
  });
});
