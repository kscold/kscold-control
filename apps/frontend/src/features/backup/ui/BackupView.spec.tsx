import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PERMISSIONS } from '@/shared/config/permissions';
import { useAuthStore, useModalStore } from '@/shared/model';
import { Modal } from '@/shared/ui/Modal';
import { backupTargetService } from '../api/backup-target.service';
import type {
  BackupOverview,
  BackupRun,
  BackupTargetStatus,
} from '../model/backup.types';
import { BackupView } from './BackupView';

const successRun: BackupRun = {
  id: 'run-1',
  targetId: 'target-1',
  targetName: 'app-prod',
  trigger: 'schedule',
  status: 'success',
  message: '백업을 완료했습니다.',
  archivePath: '/backups/app-prod/2026-10-05_18-30-02',
  archiveSizeBytes: 204800,
  pruned: [],
  actorEmail: null,
  startedAt: '2026-10-05T18:30:00.000Z',
  finishedAt: '2026-10-05T18:30:04.000Z',
};

function buildTarget(
  overrides: Partial<BackupTargetStatus> = {},
): BackupTargetStatus {
  return {
    id: 'target-1',
    name: 'app-prod',
    description: '운영 DB',
    engine: 'mongodb',
    connectionSummary: 'mongodb+srv://cluster.example.net/prod',
    dumpImage: 'mongo:7',
    retentionDays: 10,
    scheduleTime: '03:30',
    enabled: true,
    createdAt: '2026-10-06T05:00:00.000Z',
    updatedAt: '2026-10-06T05:00:00.000Z',
    running: false,
    nextRunAt: '2026-10-06T18:30:00.000Z',
    lastRun: successRun,
    archives: [
      {
        name: '2026-10-05_18-30-02',
        takenAt: '2026-10-05T18:30:02.000Z',
        path: '/backups/app-prod/2026-10-05_18-30-02',
        sizeBytes: 204800,
      },
    ],
    ...overrides,
  };
}

function overviewOf(...items: BackupTargetStatus[]): BackupOverview {
  return { timeZone: 'Asia/Seoul', items };
}

function signIn(permissions: string[]) {
  useAuthStore.setState({
    token: 'token',
    user: {
      id: 'user-1',
      email: 'admin@example.com',
      roles: ['admin'],
      permissions,
    },
    impersonation: null,
    isValidating: false,
  });
}

function renderView() {
  return render(
    <>
      <BackupView />
      <Modal />
    </>,
  );
}

describe('BackupView', () => {
  beforeEach(() => {
    signIn([PERMISSIONS.BACKUP_READ, PERMISSIONS.BACKUP_MANAGE]);
    useModalStore.getState().close();
    vi.spyOn(backupTargetService, 'getOverview').mockResolvedValue(
      overviewOf(buildTarget()),
    );
    vi.spyOn(backupTargetService, 'listRuns').mockResolvedValue([successRun]);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('대상의 설정과 최근 실행, 실행 이력을 보여준다', async () => {
    renderView();

    const card = (
      await screen.findByRole('heading', { name: 'app-prod' })
    ).closest('article') as HTMLElement;

    expect(within(card).getByText('MongoDB')).toBeInTheDocument();
    expect(within(card).getByText('사용 중')).toBeInTheDocument();
    expect(
      within(card).getByText('mongodb+srv://cluster.example.net/prod'),
    ).toBeInTheDocument();
    expect(within(card).getByText('매일 03:30')).toBeInTheDocument();
    expect(within(card).getByText('10일')).toBeInTheDocument();
    expect(within(card).getByText('백업을 완료했습니다.')).toBeInTheDocument();

    const history = screen
      .getByRole('heading', { name: /실행 이력/ })
      .closest('section') as HTMLElement;
    expect(within(history).getByText('성공')).toBeInTheDocument();
    expect(within(history).getByText('예약')).toBeInTheDocument();
  });

  it('보관 중인 백업은 펼쳐야 목록과 복원 방법이 보인다', async () => {
    const user = userEvent.setup();
    renderView();
    await screen.findByRole('heading', { name: 'app-prod' });

    expect(
      screen.queryByText('/backups/app-prod/2026-10-05_18-30-02'),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /보관 중인 백업/ }));

    expect(
      screen.getByText('/backups/app-prod/2026-10-05_18-30-02'),
    ).toBeInTheDocument();
    expect(screen.getByText('복원 방법')).toBeInTheDocument();
  });

  it('조회 권한만 있으면 변경·실행 버튼을 보여주지 않는다', async () => {
    signIn([PERMISSIONS.BACKUP_READ]);
    renderView();
    await screen.findByRole('heading', { name: 'app-prod' });

    expect(
      screen.queryByRole('button', { name: '대상 추가' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '지금 실행' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '수정' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'app-prod 삭제' }),
    ).not.toBeInTheDocument();
  });

  it('대상이 없으면 첫 대상을 추가하도록 안내한다', async () => {
    vi.mocked(backupTargetService.getOverview).mockResolvedValue(overviewOf());
    vi.mocked(backupTargetService.listRuns).mockResolvedValue([]);
    renderView();

    expect(
      await screen.findByText('등록된 백업 대상이 없습니다.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '첫 대상 추가' }),
    ).toBeInTheDocument();
    expect(screen.getByText('아직 실행 기록이 없습니다.')).toBeInTheDocument();
  });

  it('조회에 실패하면 서버가 보낸 이유를 보여준다', async () => {
    vi.mocked(backupTargetService.getOverview).mockRejectedValue(
      new Error('백업 현황 조회 실패'),
    );
    renderView();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '백업 현황 조회 실패',
    );
  });

  it('지금 실행을 누르면 백업을 시작하고 시작했다고 알린다', async () => {
    const user = userEvent.setup();
    const runTarget = vi
      .spyOn(backupTargetService, 'runTarget')
      .mockResolvedValue({ ...successRun, status: 'running' });
    renderView();

    await user.click(await screen.findByRole('button', { name: '지금 실행' }));

    expect(runTarget).toHaveBeenCalledWith('target-1');
    expect(await screen.findByRole('status')).toHaveTextContent(
      'app-prod 백업을 시작했습니다',
    );
  });

  it('실행 중이던 백업이 끝나면 결과를 알린다', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(backupTargetService.getOverview)
      .mockResolvedValueOnce(
        overviewOf(buildTarget({ running: true, lastRun: null })),
      )
      .mockResolvedValue(overviewOf(buildTarget({ running: false })));
    renderView();

    expect(await screen.findByText('백업 중')).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });

    expect(await screen.findByRole('status')).toHaveTextContent(
      'app-prod 백업을 완료했습니다 (200.0 KB).',
    );
    expect(screen.queryByText('백업 중')).not.toBeInTheDocument();
  });

  it('실패한 실행은 실패 사유를 알린다', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const failedRun: BackupRun = {
      ...successRun,
      status: 'failed',
      message: '백업 실패: 인증 실패',
      archivePath: null,
      archiveSizeBytes: null,
    };
    vi.mocked(backupTargetService.getOverview)
      .mockResolvedValueOnce(overviewOf(buildTarget({ running: true })))
      .mockResolvedValue(
        overviewOf(buildTarget({ running: false, lastRun: failedRun })),
      );
    renderView();
    await screen.findByText('백업 중');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });

    expect(await screen.findByRole('status')).toHaveTextContent(
      'app-prod: 백업 실패: 인증 실패',
    );
  });

  it('새 대상을 등록한다', async () => {
    const user = userEvent.setup();
    const createTarget = vi
      .spyOn(backupTargetService, 'createTarget')
      .mockResolvedValue(buildTarget({ id: 'target-2', name: 'blog-prod' }));
    renderView();

    await user.click(await screen.findByRole('button', { name: '대상 추가' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('이름'), 'blog-prod');
    await user.type(within(dialog).getByLabelText('설명 (선택)'), '블로그 DB');
    await user.type(
      within(dialog).getByLabelText('접속 URI'),
      'mongodb://reader:pass@db.example.net:27017/blog',
    );
    await user.clear(within(dialog).getByLabelText('보관 기간 (일)'));
    await user.type(within(dialog).getByLabelText('보관 기간 (일)'), '14');
    await user.click(within(dialog).getByRole('button', { name: '대상 추가' }));

    await waitFor(() =>
      expect(createTarget).toHaveBeenCalledWith({
        name: 'blog-prod',
        description: '블로그 DB',
        uri: 'mongodb://reader:pass@db.example.net:27017/blog',
        retentionDays: 14,
        scheduleTime: '03:30',
        dumpImage: 'mongo:7',
        enabled: true,
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
  });

  it('모달을 닫았다 다시 열면 입력하던 접속 URI 가 남아 있지 않다', async () => {
    const user = userEvent.setup();
    vi.spyOn(backupTargetService, 'createTarget').mockResolvedValue(
      buildTarget({ id: 'target-2', name: 'blog-prod' }),
    );
    renderView();

    await user.click(await screen.findByRole('button', { name: '대상 추가' }));
    await user.type(
      within(screen.getByRole('dialog')).getByLabelText('접속 URI'),
      'mongodb://reader:secret@db.example.net/blog',
    );
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: '취소' }),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // 등록 창을 다시 열어도, 수정 창을 열어도 비어 있어야 한다.
    await user.click(screen.getByRole('button', { name: '대상 추가' }));
    expect(
      within(screen.getByRole('dialog')).getByLabelText('접속 URI'),
    ).toHaveValue('');
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: '취소' }),
    );

    await user.click(screen.getByRole('button', { name: '수정' }));
    expect(
      within(screen.getByRole('dialog')).getByLabelText(
        '접속 URI (바꿀 때만 입력)',
      ),
    ).toHaveValue('');
  });

  it('형식이 틀린 입력은 서버로 보내지 않고 바로 알려준다', async () => {
    const user = userEvent.setup();
    const createTarget = vi.spyOn(backupTargetService, 'createTarget');
    renderView();

    await user.click(await screen.findByRole('button', { name: '대상 추가' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('이름'), '잘못된 이름');
    await user.click(within(dialog).getByRole('button', { name: '대상 추가' }));

    expect(within(dialog).getByRole('alert')).toHaveTextContent(
      '이름은 영문·숫자로 시작',
    );

    await user.clear(within(dialog).getByLabelText('이름'));
    await user.type(within(dialog).getByLabelText('이름'), 'blog-prod');
    await user.type(
      within(dialog).getByLabelText('접속 URI'),
      'postgres://db.example.net/blog',
    );
    await user.click(within(dialog).getByRole('button', { name: '대상 추가' }));

    expect(within(dialog).getByRole('alert')).toHaveTextContent(
      'mongodb:// 또는 mongodb+srv://',
    );
    expect(createTarget).not.toHaveBeenCalled();
  });

  it('서버가 등록을 거절하면 모달을 닫지 않고 이유를 보여준다', async () => {
    const user = userEvent.setup();
    vi.spyOn(backupTargetService, 'createTarget').mockRejectedValue(
      new Error('같은 이름의 백업 대상이 이미 있습니다.'),
    );
    renderView();

    await user.click(await screen.findByRole('button', { name: '대상 추가' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('이름'), 'app-prod');
    await user.type(
      within(dialog).getByLabelText('접속 URI'),
      'mongodb://db.example.net/app',
    );
    await user.click(within(dialog).getByRole('button', { name: '대상 추가' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      '같은 이름의 백업 대상이 이미 있습니다.',
    );
  });

  it('수정할 때 접속 URI 를 비워 두면 보내지 않는다', async () => {
    const user = userEvent.setup();
    const updateTarget = vi
      .spyOn(backupTargetService, 'updateTarget')
      .mockResolvedValue(buildTarget({ retentionDays: 30 }));
    renderView();

    await user.click(await screen.findByRole('button', { name: '수정' }));
    const dialog = screen.getByRole('dialog');

    expect(within(dialog).getByLabelText('이름')).toBeDisabled();
    expect(within(dialog).getByLabelText('이름')).toHaveValue('app-prod');
    // 저장된 접속 URI 는 화면으로 내려오지 않는다.
    expect(
      within(dialog).getByLabelText('접속 URI (바꿀 때만 입력)'),
    ).toHaveValue('');
    expect(
      within(dialog).getByText(/mongodb\+srv:\/\/cluster\.example\.net\/prod/),
    ).toBeInTheDocument();

    await user.clear(within(dialog).getByLabelText('보관 기간 (일)'));
    await user.type(within(dialog).getByLabelText('보관 기간 (일)'), '30');
    await user.click(within(dialog).getByRole('button', { name: '저장' }));

    await waitFor(() =>
      expect(updateTarget).toHaveBeenCalledWith('target-1', {
        description: '운영 DB',
        retentionDays: 30,
        scheduleTime: '03:30',
        dumpImage: 'mongo:7',
        enabled: true,
      }),
    );
  });

  it('스위치로 예약 백업을 끄고 켠다', async () => {
    const user = userEvent.setup();
    const updateTarget = vi
      .spyOn(backupTargetService, 'updateTarget')
      .mockResolvedValue(buildTarget({ enabled: false }));
    renderView();

    const toggle = await screen.findByRole('switch', {
      name: 'app-prod 예약 백업 사용',
    });
    expect(toggle).toBeChecked();

    await user.click(toggle);

    expect(updateTarget).toHaveBeenCalledWith('target-1', { enabled: false });
    expect(await screen.findByRole('status')).toHaveTextContent(
      'app-prod 예약 백업을 일시 중지했습니다.',
    );
  });

  it('삭제는 백업 파일이 남는다고 알린 뒤 확인을 받고 진행한다', async () => {
    const user = userEvent.setup();
    const removeTarget = vi
      .spyOn(backupTargetService, 'removeTarget')
      .mockResolvedValue(buildTarget());
    renderView();

    await user.click(
      await screen.findByRole('button', { name: 'app-prod 삭제' }),
    );

    expect(
      screen.getByText(/이미 만든 백업 파일 1개는 서버에 그대로 남습니다/),
    ).toBeInTheDocument();
    expect(removeTarget).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '확인' }));

    await waitFor(() => expect(removeTarget).toHaveBeenCalledWith('target-1'));
  });

  it('삭제 확인에서 취소하면 지우지 않는다', async () => {
    const user = userEvent.setup();
    const removeTarget = vi.spyOn(backupTargetService, 'removeTarget');
    renderView();

    await user.click(
      await screen.findByRole('button', { name: 'app-prod 삭제' }),
    );
    await user.click(screen.getByRole('button', { name: '취소' }));

    expect(removeTarget).not.toHaveBeenCalled();
  });

  it('이력을 대상별로 걸러 조회한다', async () => {
    const user = userEvent.setup();
    renderView();
    await screen.findByRole('heading', { name: 'app-prod' });

    await user.selectOptions(screen.getByLabelText('대상'), 'target-1');

    await waitFor(() =>
      expect(backupTargetService.listRuns).toHaveBeenLastCalledWith({
        targetId: 'target-1',
        limit: 30,
      }),
    );
  });
});
