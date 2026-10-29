import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { PERMISSIONS } from '@/shared/config/permissions';
import { useAuthStore, useModalStore } from '@/shared/model';
import { Modal } from '@/shared/ui/Modal';
import { storageService } from '../api/storage.service';
import type { StorageOverview } from '../model/maintenance.types';
import { StorageOverviewView } from './StorageOverviewView';

const GiB = 1024 ** 3;

const overview: StorageOverview = {
  measuredAt: '2026-10-29T01:00:00.000Z',
  host: { totalBytes: 228 * GiB, usedBytes: 214 * GiB, freeBytes: 14 * GiB },
  dockerVm: {
    path: '/home/example/vm/datadisk',
    allocatedBytes: 62 * GiB,
    usedBytes: 47 * GiB,
    reclaimableBytes: 15 * GiB,
    heldDeletedBytes: 3 * GiB,
    heldDeletedFiles: 2,
  },
  docker: {
    containers: [
      {
        name: 'app-large',
        image: 'app:2',
        state: 'running',
        writableBytes: 10 * GiB,
        oversized: true,
      },
      {
        name: 'app-small',
        image: 'app:1',
        state: 'running',
        writableBytes: GiB / 4,
        oversized: false,
      },
    ],
    unusedImages: [
      { id: 'cdac329d9115', reference: null, sizeBytes: GiB, uniqueBytes: GiB },
    ],
    unreferencedVolumes: [
      { name: 'old-db', sizeBytes: GiB / 2, project: 'infra' },
    ],
    buildCacheBytes: 0,
  },
  folders: [
    {
      key: 'trash',
      label: '휴지통',
      description: '비우기 전까지 공간을 그대로 차지함',
      path: '/home/example/.Trash',
      sizeBytes: GiB,
    },
    {
      key: 'codex-sessions',
      label: 'Codex 대화 기록',
      description: '',
      path: '/home/example/.codex/sessions',
      sizeBytes: 4 * GiB,
    },
  ],
  warnings: ['VM이 열어 둔 파일: lsof 시간 초과'],
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

function renderView() {
  return render(
    <MemoryRouter>
      <StorageOverviewView />
      <Modal />
    </MemoryRouter>,
  );
}

describe('StorageOverviewView', () => {
  beforeEach(() => {
    signIn([PERMISSIONS.SYSTEM_READ, PERMISSIONS.SYSTEM_WRITE]);
    useModalStore.getState().close();
    vi.spyOn(storageService, 'getOverview').mockResolvedValue(overview);
  });

  afterEach(() => vi.restoreAllMocks());

  it('맥 여유 공간, 돌려줄 수 있는 공간, 커진 컨테이너와 큰 폴더를 보여준다', async () => {
    renderView();

    expect(await screen.findByText('14.0 GiB 남음')).toBeInTheDocument();
    expect(screen.getByText('15.0 GiB')).toBeInTheDocument();
    expect(screen.getByText('3.0 GiB')).toBeInTheDocument();
    expect(screen.getByText('1개가 5 GiB를 넘었습니다')).toBeInTheDocument();
    expect(
      screen.getByText('이름 없는 이미지 cdac329d9115'),
    ).toBeInTheDocument();
    expect(screen.getByText('infra 프로젝트')).toBeInTheDocument();
    expect(
      screen.getByText('VM이 열어 둔 파일: lsof 시간 초과'),
    ).toBeInTheDocument();
    const folders = screen.getAllByText(/Codex 대화 기록|휴지통/);
    expect(folders.map((node) => node.textContent)).toEqual([
      'Codex 대화 기록',
      '휴지통',
    ]);
  });

  it('공간 반환을 확인받은 뒤 실행하고 돌려준 크기를 알려준다', async () => {
    const user = userEvent.setup();
    const trim = vi.spyOn(storageService, 'trimDockerDisk').mockResolvedValue({
      trimmedBytes: 63 * GiB,
      allocatedBeforeBytes: 62 * GiB,
      allocatedAfterBytes: 28 * GiB,
    });
    renderView();

    await user.click(await screen.findByRole('button', { name: '공간 반환' }));
    expect(trim).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: '확인' }));

    await waitFor(() => expect(trim).toHaveBeenCalledTimes(1));
    expect(
      await screen.findByText(/맥에 34.0 GiB를 돌려줬습니다/),
    ).toBeInTheDocument();
  });

  it('조회 권한만 있으면 공간 반환 버튼을 보여주지 않는다', async () => {
    signIn([PERMISSIONS.SYSTEM_READ]);
    renderView();

    await screen.findByText('14.0 GiB 남음');
    expect(
      screen.queryByRole('button', { name: '공간 반환' }),
    ).not.toBeInTheDocument();
  });
});
