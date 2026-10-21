import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PERMISSIONS } from '@/shared/config/permissions';
import { useAuthStore, useModalStore } from '@/shared/model';
import { Modal } from '@/shared/ui/Modal';
import { worktreeCleanupService } from '../api/worktree-cleanup.service';
import type { WorktreeCleanupTargetStatus } from '../model/maintenance.types';
import { WorktreeCleanupView } from './WorktreeCleanupView';

const target: WorktreeCleanupTargetStatus = {
  id: 't1',
  name: 'pawpong-review',
  description: 'Pawpong 작업 폴더',
  rootPath: '/Users/kscold/Desktop/pawpong-review/.worktrees',
  keepRecent: 3,
  protectUnmerged: true,
  baseRefs: ['origin/dev', 'origin/main'],
  scheduleTime: '04:30',
  enabled: true,
  createdAt: '2026-10-21T00:00:00.000Z',
  updatedAt: '2026-10-21T00:00:00.000Z',
  running: false,
  nextRunAt: '2026-10-21T19:30:00.000Z',
  lastRun: null,
};

function signIn(permissions: string[]) {
  useAuthStore.setState({
    token: 'token',
    user: {
      id: 'u1',
      email: 'admin@example.com',
      roles: ['admin'],
      permissions,
    },
    impersonation: null,
    isValidating: false,
  });
}

describe('WorktreeCleanupView', () => {
  beforeEach(() => {
    signIn([PERMISSIONS.SYSTEM_READ, PERMISSIONS.SYSTEM_WRITE]);
    useModalStore.getState().close();
    vi.spyOn(worktreeCleanupService, 'getOverview').mockResolvedValue({
      timeZone: 'Asia/Seoul',
      items: [target],
    });
    vi.spyOn(worktreeCleanupService, 'listRuns').mockResolvedValue([]);
  });

  afterEach(() => vi.restoreAllMocks());

  it('미리보기로 지울 폴더와 남길 이유를 보여준다', async () => {
    const user = userEvent.setup();
    vi.spyOn(worktreeCleanupService, 'preview').mockResolvedValue({
      staleRepositories: [],
      items: [
        {
          name: 'recent',
          path: '/r/recent',
          branch: 'a',
          lastActivityAt: '2026-10-20T00:00:00.000Z',
          sizeBytes: 1024 ** 3,
          action: 'keep',
          reasons: ['recent'],
        },
        {
          name: 'wip',
          path: '/r/wip',
          branch: 'b',
          lastActivityAt: '2026-10-01T00:00:00.000Z',
          sizeBytes: 1024 ** 3,
          action: 'keep',
          reasons: ['unpushed-commits'],
        },
        {
          name: 'old',
          path: '/r/old',
          branch: 'c',
          lastActivityAt: '2026-09-01T00:00:00.000Z',
          sizeBytes: 2 * 1024 ** 3,
          action: 'remove',
          reasons: [],
        },
      ],
    });
    render(<WorktreeCleanupView />);

    await user.click(await screen.findByRole('button', { name: '미리보기' }));

    expect(await screen.findByText(/지울 폴더/)).toHaveTextContent(
      '지울 폴더 1개 · 폴더 크기 합 2.0 GiB',
    );
    const row = screen.getByText('wip').closest('tr') as HTMLElement;
    expect(within(row).getByText('푸시 안 한 커밋')).toBeInTheDocument();
    expect(
      within(screen.getByText('old').closest('tr') as HTMLElement).getByText(
        '정리',
      ),
    ).toBeInTheDocument();
  });

  it('지금 정리는 확인을 받은 뒤 시작한다', async () => {
    const user = userEvent.setup();
    const run = vi
      .spyOn(worktreeCleanupService, 'run')
      .mockResolvedValue({} as never);
    render(
      <>
        <WorktreeCleanupView />
        <Modal />
      </>,
    );

    await user.click(await screen.findByRole('button', { name: '지금 정리' }));
    expect(run).not.toHaveBeenCalled();
    expect(
      screen.getByText(/로컬 파일과 복원 방법은 백업으로 남깁니다/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '확인' }));

    await waitFor(() => expect(run).toHaveBeenCalledWith('t1'));
    expect(await screen.findByRole('status')).toHaveTextContent(
      '정리를 시작했습니다',
    );
  });

  it('조회 권한만 있으면 미리보기만 보이고 변경 버튼은 없다', async () => {
    signIn([PERMISSIONS.SYSTEM_READ]);
    render(<WorktreeCleanupView />);

    expect(
      await screen.findByRole('button', { name: '미리보기' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '지금 정리' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '대상 추가' }),
    ).not.toBeInTheDocument();
  });

  it('새 대상을 기본값으로 등록한다', async () => {
    const user = userEvent.setup();
    const create = vi
      .spyOn(worktreeCleanupService, 'createTarget')
      .mockResolvedValue(target);
    render(<WorktreeCleanupView />);

    await user.click(await screen.findByRole('button', { name: '대상 추가' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('이름'), 'other');
    await user.type(
      within(dialog).getByLabelText('정리 루트'),
      '/Users/kscold/work/.worktrees',
    );
    await user.click(within(dialog).getByRole('button', { name: '대상 추가' }));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({
        name: 'other',
        rootPath: '/Users/kscold/work/.worktrees',
        description: '',
        keepRecent: 3,
        protectUnmerged: true,
        baseRefs: ['origin/dev', 'origin/main', 'origin/master'],
        scheduleTime: '04:30',
        enabled: true,
      }),
    );
  });
});
