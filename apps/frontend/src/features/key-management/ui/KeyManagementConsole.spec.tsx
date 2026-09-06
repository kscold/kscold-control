import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { KeyManagementTarget } from '../model/types';
import { KeyManagementConsole } from './KeyManagementConsole';

const mocks = vi.hoisted(() => ({
  useKeyManagement: vi.fn(),
  showAlert: vi.fn(),
  showConfirm: vi.fn(),
}));

vi.mock('../model/useKeyManagement', () => ({
  useKeyManagement: mocks.useKeyManagement,
}));

vi.mock('@/shared/model', () => ({
  useModalStore: () => ({
    showAlert: mocks.showAlert,
    showConfirm: mocks.showConfirm,
  }),
}));

const gole: KeyManagementTarget = {
  id: 'gole-production',
  displayName: 'GoLe Production',
  description: 'GCP에서 운영되는 GoLe 환경',
  environment: 'production',
  provider: 'gcp-secret-manager',
  deploymentProvider: 'github-actions',
  envFileName: 'gole.env',
  instanceName: 'gole-production',
  location: 'GCP asia-northeast3-a',
  requiredKeys: ['MONGODB_URI'],
  version: '6',
  updatedAt: '2026-09-06T00:00:00.000Z',
  checksum: 'a'.repeat(64),
  keyCount: 1,
  keys: ['MONGODB_URI'],
  connectionStatus: 'healthy',
  connectionError: null,
};

const pawpong: KeyManagementTarget = {
  id: 'pawpong-production',
  displayName: 'Pawpong Production',
  description: 'SSH에서 운영되는 Pawpong 환경',
  environment: 'production',
  provider: 'ssh-env-file',
  deploymentProvider: 'ssh-blue-green',
  envFileName: '.env.production',
  instanceName: 'colding-304515',
  location: '115.68.227.188',
  requiredKeys: ['NODE_ENV'],
  version: 'b'.repeat(64),
  updatedAt: '2026-09-06T00:00:00.000Z',
  checksum: 'b'.repeat(64),
  keyCount: 57,
  keys: ['NODE_ENV'],
  connectionStatus: 'healthy',
  connectionError: null,
};

function hookState(target: KeyManagementTarget) {
  return {
    targets: [gole, pawpong],
    selectedTargetId: target.id,
    target,
    backups: [],
    revealed: null,
    editorValue: '',
    isLoading: false,
    isWorking: false,
    error: null,
    setEditorValue: vi.fn(),
    clearReveal: vi.fn(),
    selectTarget: vi.fn(),
    load: vi.fn(),
    reveal: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    retry: vi.fn(),
  };
}

describe('KeyManagementConsole multi-target view', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('DB 운영 대상과 공급자 정보를 표시하고 대상 전환을 요청한다', async () => {
    const user = userEvent.setup();
    const state = hookState(gole);
    mocks.useKeyManagement.mockReturnValue(state);

    render(<KeyManagementConsole />);

    expect(
      screen.getByRole('heading', {
        name: 'GoLe Production 환경 변수 운영실',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('GCP Secret Manager')).toBeInTheDocument();
    expect(screen.getByText('SSH blue/green')).toBeInTheDocument();
    expect(screen.getByText('sha256:bbbbbbbbbbbb')).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: /Pawpong Production/ }),
    );
    expect(state.selectTarget).toHaveBeenCalledWith('pawpong-production');
  });

  it('연결할 수 없는 대상은 비밀 공개 동작을 차단한다', () => {
    const unavailable = {
      ...pawpong,
      version: null,
      connectionStatus: 'unavailable' as const,
      connectionError: '운영 키 저장소 연결 상태를 확인하지 못했습니다.',
    };
    mocks.useKeyManagement.mockReturnValue(hookState(unavailable));

    render(<KeyManagementConsole />);

    expect(
      screen.getByRole('button', { name: /60초 동안 공개/ }),
    ).toBeDisabled();
    expect(
      screen.getByText('Pawpong Production 연결 확인 필요'),
    ).toBeInTheDocument();
  });

  it('이전 API 응답이 잠시 섞여도 잘못된 배포 방식과 undefined를 표시하지 않는다', () => {
    const legacy = {
      ...gole,
      deploymentProvider: undefined,
      location: undefined,
      connectionStatus: undefined,
    } as unknown as KeyManagementTarget;
    mocks.useKeyManagement.mockReturnValue({
      ...hookState(legacy),
      targets: [legacy],
    });

    render(<KeyManagementConsole />);

    expect(screen.getByText('배포 메타데이터 동기화 중')).toBeInTheDocument();
    expect(screen.queryByText(/undefined/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /60초 동안 공개/ }),
    ).toBeEnabled();
  });
});
