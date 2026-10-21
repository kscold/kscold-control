import {
  BadRequestException,
  ConflictException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { WorktreeCleanupRunnerService } from '@/maintenance/application/services/worktree-cleanup-runner.service';
import { WorktreeCleanupSchedulerService } from '@/maintenance/application/services/worktree-cleanup-scheduler.service';
import { ManageWorktreeCleanupTargetUseCase } from '@/maintenance/application/use-cases';
import type { WorktreeCleanupTarget } from '@/maintenance/domain/entities/worktree-cleanup-target.entity';
import type { WorktreeInspection } from '@/maintenance/domain/types/worktree.type';

const target = {
  id: 'target-1',
  name: 'pawpong',
  rootPath: '/Users/kscold/Desktop/pawpong-review/.worktrees',
  keepRecent: 1,
  protectUnmerged: true,
  baseRefs: ['origin/dev'],
  scheduleTime: '04:30',
  enabled: true,
  scheduleCursorAt: new Date('2026-10-20T00:00:00.000Z'),
  description: '',
} as WorktreeCleanupTarget;

function inspection(
  name: string,
  daysAgo: number,
  overrides: Partial<WorktreeInspection> = {},
): WorktreeInspection {
  return {
    name,
    path: `${target.rootPath}/${name}`,
    repositoryPath: '/repo',
    branch: name,
    headSha: 'a'.repeat(40),
    lastActivityAt: new Date(Date.UTC(2026, 9, 21) - daysAgo * 86_400_000),
    uncommittedCount: 0,
    unpushedCount: 0,
    merged: true,
    active: false,
    sizeBytes: 2 * 1024 ** 3,
    ...overrides,
  };
}

describe('작업 폴더 정리 실행', () => {
  const targetRepository = {
    findById: jest.fn(),
    findEnabled: jest.fn(),
    findByNameOrRoot: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    moveScheduleCursor: jest.fn(),
  };
  const runRepository = {
    start: jest.fn(),
    finish: jest.fn(),
    failUnfinished: jest.fn(),
  };
  const workspace = {
    rootExists: jest.fn(),
    scan: jest.fn(),
    remove: jest.fn(),
  };
  let runner: WorktreeCleanupRunnerService;

  beforeEach(() => {
    jest.resetAllMocks();
    for (const level of ['log', 'warn', 'error'] as const) {
      jest.spyOn(Logger.prototype, level).mockImplementation(() => undefined);
    }
    targetRepository.findById.mockResolvedValue(target);
    workspace.rootExists.mockResolvedValue(true);
    workspace.scan.mockResolvedValue({
      inspections: [
        inspection('new', 1),
        inspection('old', 10),
        inspection('wip', 20, { unpushedCount: 2 }),
      ],
      failures: [],
      staleRepositories: [],
    });
    workspace.remove.mockImplementation(({ inspection: item }) =>
      Promise.resolve({
        name: item.name,
        branch: item.branch,
        headSha: item.headSha,
        repositoryPath: '/repo',
        sizeBytes: item.sizeBytes,
        backupPath: `/backup/${item.name}`,
      }),
    );
    runRepository.start.mockImplementation((input) =>
      Promise.resolve({ id: 'run-1', ...input, status: 'running' }),
    );
    runRepository.finish.mockImplementation((id, outcome) =>
      Promise.resolve({ id, ...outcome }),
    );
    runner = new WorktreeCleanupRunnerService(
      targetRepository as never,
      runRepository as never,
      workspace as never,
    );
  });

  afterAll(() => jest.restoreAllMocks());

  it('미리보기는 아무것도 지우지 않고 남길 것과 지울 것만 알려준다', async () => {
    const plan = await runner.plan(target);

    expect(plan.decisions.map((d) => [d.name, d.action, d.reasons])).toEqual([
      ['new', 'keep', ['recent']],
      ['old', 'remove', []],
      ['wip', 'keep', ['unpushed-commits']],
    ]);
    expect(workspace.remove).not.toHaveBeenCalled();
  });

  it('지워도 되는 폴더만 지우고, 확보한 용량과 남긴 이유를 기록한다', async () => {
    const run = await runner.runToCompletion('target-1', 'schedule');

    expect(workspace.scan).toHaveBeenCalledTimes(1);
    expect(workspace.remove).toHaveBeenCalledTimes(1);
    expect(workspace.remove).toHaveBeenCalledWith(
      expect.objectContaining({
        targetName: 'pawpong',
        inspection: expect.objectContaining({ name: 'old' }),
      }),
    );
    expect(run).toMatchObject({
      status: 'success',
      freedBytes: 2 * 1024 ** 3,
      removed: [
        expect.objectContaining({ name: 'old', backupPath: '/backup/old' }),
      ],
      kept: [
        { name: 'new', reasons: ['recent'] },
        { name: 'wip', reasons: ['unpushed-commits'] },
      ],
    });
    expect(run.message).toContain('1개를 정리했습니다 (2.0GiB 확보)');
  });

  it('한 폴더를 지우지 못해도 실행은 끝까지 하고 그 폴더는 남긴 것으로 기록한다', async () => {
    workspace.scan.mockResolvedValueOnce({
      inspections: [
        inspection('a', 10),
        inspection('b', 11),
        inspection('keep', 1),
      ],
      failures: [],
      staleRepositories: ['/repo'],
    });
    workspace.remove.mockRejectedValueOnce(
      new Error('새 커밋이 생겨 지우지 않았습니다.'),
    );

    const run = await runner.runToCompletion('target-1', 'manual');

    expect(workspace.remove).toHaveBeenCalledTimes(2);
    expect(run.status).toBe('success');
    expect(run.removed.map((r) => r.name)).toEqual(['b']);
    expect(run.kept).toContainEqual({
      name: 'a',
      reasons: ['inspection-failed'],
    });
    expect(run.message).toContain('지우지 못한 폴더: a: 새 커밋');
    expect(run.message).toContain('예전 상태로 판단');
  });

  it('정리 루트가 사라졌으면 실패로 기록하고 아무것도 지우지 않는다', async () => {
    workspace.rootExists.mockResolvedValue(false);

    const run = await runner.runToCompletion('target-1', 'schedule');

    expect(run.status).toBe('failed');
    expect(workspace.remove).not.toHaveBeenCalled();
  });

  it('같은 대상을 겹쳐 실행하지 않는다', async () => {
    let release: () => void = () => undefined;
    workspace.scan.mockReturnValueOnce(
      new Promise((resolve) => {
        release = () =>
          resolve({ inspections: [], failures: [], staleRepositories: [] });
      }),
    );
    const first = runner.runToCompletion('target-1', 'schedule');
    await new Promise((resolve) => setImmediate(resolve));

    await expect(runner.start('target-1', 'manual')).rejects.toBeInstanceOf(
      ConflictException,
    );
    release();
    await first;
    expect(runner.isRunning('target-1')).toBe(false);
  });

  it('없는 대상은 거부한다', async () => {
    targetRepository.findById.mockResolvedValueOnce(null);
    await expect(runner.start('missing', 'manual')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  describe('스케줄러', () => {
    it('예약 시각이 된 대상만 기준 시각을 옮긴 뒤 정리한다', async () => {
      const scheduler = new WorktreeCleanupSchedulerService(
        targetRepository as never,
        runner,
      );
      targetRepository.findEnabled.mockResolvedValue([target]);
      // 2026-10-21 04:30 KST = 10-20 19:30 UTC
      const due = new Date('2026-10-20T19:30:20.000Z');

      await expect(
        scheduler.runDueTargets(new Date('2026-10-20T19:00:00.000Z')),
      ).resolves.toBe(0);
      await expect(scheduler.runDueTargets(due)).resolves.toBe(1);
      expect(targetRepository.moveScheduleCursor).toHaveBeenCalledWith(
        'target-1',
        due,
      );
    });
  });
});

describe('작업 폴더 정리 대상 관리', () => {
  const targetRepository = {
    findById: jest.fn(),
    findByNameOrRoot: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };
  const workspace = { rootExists: jest.fn() };
  const runner = { isRunning: jest.fn() };
  const useCase = new ManageWorktreeCleanupTargetUseCase(
    targetRepository as never,
    workspace as never,
    runner as never,
  );
  const home = process.env.HOME;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env.HOME = '/Users/kscold';
    workspace.rootExists.mockResolvedValue(true);
    targetRepository.findByNameOrRoot.mockResolvedValue(null);
    targetRepository.create.mockImplementation((input) =>
      Promise.resolve({ id: 'new', ...input }),
    );
    targetRepository.findById.mockResolvedValue(target);
    targetRepository.update.mockImplementation((id, changes) =>
      Promise.resolve({ ...target, ...changes }),
    );
    runner.isRunning.mockReturnValue(false);
  });

  afterAll(() => {
    process.env.HOME = home;
  });

  it('기본값(최근 3개, 미병합 보호, 04:30)으로 등록한다', async () => {
    await useCase.create({
      name: 'pawpong',
      rootPath: '/Users/kscold/Desktop/pawpong-review/.worktrees/',
      createdBy: 'u1',
    });

    expect(targetRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        rootPath: '/Users/kscold/Desktop/pawpong-review/.worktrees',
        keepRecent: 3,
        protectUnmerged: true,
        baseRefs: ['origin/dev', 'origin/main', 'origin/master'],
        scheduleTime: '04:30',
        createdBy: 'u1',
      }),
    );
  });

  it.each([
    ['홈 밖 경로', { rootPath: '/etc' }],
    ['홈 디렉터리 자체', { rootPath: '/Users/kscold' }],
    ['잘못된 기준 브랜치', { baseRefs: ['--all'] }],
    ['빈 기준 브랜치', { baseRefs: [] }],
  ])('%s 은 거부한다', async (_label, override) => {
    await expect(
      useCase.create({
        name: 'p',
        rootPath: '/Users/kscold/work',
        createdBy: null,
        ...override,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(targetRepository.create).not.toHaveBeenCalled();
  });

  it('없는 루트는 거부한다', async () => {
    workspace.rootExists.mockResolvedValue(false);
    await expect(
      useCase.create({
        name: 'p',
        rootPath: '/Users/kscold/none',
        createdBy: null,
      }),
    ).rejects.toThrow('정리 루트가 없습니다');
  });

  it('같은 이름이나 같은 루트가 있으면 거부한다', async () => {
    targetRepository.findByNameOrRoot.mockResolvedValue(target);
    await expect(
      useCase.create({
        name: 'p',
        rootPath: '/Users/kscold/work',
        createdBy: null,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('바뀐 항목만 고치고, 시각을 바꾸면 기준 시각을 옮긴다', async () => {
    const { changedFields } = await useCase.update('target-1', {
      keepRecent: 1,
      scheduleTime: '05:00',
      enabled: true,
    });

    expect(changedFields).toEqual(['scheduleTime']);
    expect(targetRepository.update).toHaveBeenCalledWith('target-1', {
      scheduleTime: '05:00',
      scheduleCursorAt: expect.any(Date),
    });
  });

  it('정리 중인 대상은 삭제하지 않는다', async () => {
    runner.isRunning.mockReturnValue(true);
    await expect(useCase.remove('target-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(targetRepository.remove).not.toHaveBeenCalled();
  });
});
