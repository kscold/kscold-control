import { render, screen, within } from '@testing-library/react';
import { storageService } from '../api/storage.service';
import type { AutomationsOverview } from '../model/maintenance.types';
import { AutomationsView } from './AutomationsView';

const overview: AutomationsOverview = {
  generatedAt: '2026-10-29T03:00:00.000Z',
  jobs: [
    {
      key: 'worktree:t1',
      kind: 'control',
      name: '작업 폴더 정리 · projectbeta',
      description: '/home/example/projectbeta/.worktrees',
      schedule: '매일 04:30',
      health: 'ok',
      lastRunAt: '2026-10-28T19:30:00.000Z',
      lastMessage: '작업 폴더 2개를 정리했습니다.',
    },
    {
      key: 'launchd:com.example.watchdog',
      kind: 'launchd',
      name: '서비스 감시',
      description: '10분마다 확인하고 두 번 연속 장애면 복구',
      schedule: '10분마다',
      health: 'failed',
      lastRunAt: '2026-10-29T02:10:00.000Z',
      lastMessage: '마지막 종료 코드 1 · 복구 실패',
    },
    {
      key: 'release:app:/releases',
      kind: 'container',
      name: '배포 릴리스',
      description: 'app 안 /releases',
      schedule: '배포가 성공할 때마다',
      health: 'ok',
      lastRunAt: null,
      lastMessage: '지금 2개 · 1.7 GiB · 남기는 기준 2개',
    },
  ],
  trimRuns: [
    {
      id: 'r1',
      trigger: 'schedule',
      status: 'succeeded',
      message: '맥에 4.0 GiB를 돌려줬습니다.',
      allocatedBeforeBytes: 0,
      allocatedAfterBytes: 0,
      actorEmail: null,
      startedAt: '2026-10-28T20:00:00.000Z',
      finishedAt: '2026-10-28T20:00:05.000Z',
    },
  ],
  warnings: [],
};

describe('AutomationsView', () => {
  beforeEach(() => {
    vi.spyOn(storageService, 'getAutomations').mockResolvedValue(overview);
  });

  afterEach(() => vi.restoreAllMocks());

  it('어디서 도는지에 따라 묶어 보여주고 실패한 작업을 눈에 띄게 알린다', async () => {
    render(<AutomationsView />);

    expect(await screen.findByText('전체 3개 · 정상 2개')).toBeInTheDocument();
    expect(screen.getByText('· 실패 1개')).toBeInTheDocument();

    const launchd = screen
      .getByRole('heading', { name: '맥 자동 실행 작업' })
      .closest('section')!;
    expect(within(launchd).getByText('서비스 감시')).toBeInTheDocument();
    expect(within(launchd).getByText('실패')).toBeInTheDocument();
    expect(
      within(launchd).getByText(/마지막 종료 코드 1 · 복구 실패/),
    ).toBeInTheDocument();

    // 맥 작업의 시각은 실행 시각이 아니라 출력 기록이 바뀐 시각이다
    expect(within(launchd).getByText(/^마지막 출력 /)).toBeInTheDocument();

    const container = screen
      .getByRole('heading', { name: '컨테이너 안 자동 정리' })
      .closest('section')!;
    expect(
      within(container).getByText(/지금 2개 · 1.7 GiB · 남기는 기준 2개/),
    ).toBeInTheDocument();
    expect(
      within(container).getByText('아직 실행 기록이 없습니다'),
    ).toBeInTheDocument();

    const trims = screen
      .getByRole('heading', { name: '공간 반환 기록' })
      .closest('section')!;
    expect(within(trims).getByText(/예약/)).toBeInTheDocument();
    expect(
      within(trims).getByText('맥에 4.0 GiB를 돌려줬습니다.'),
    ).toBeInTheDocument();
  });
});
