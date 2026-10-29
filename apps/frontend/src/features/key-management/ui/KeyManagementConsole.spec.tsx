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

const projectalpha: KeyManagementTarget = {
  id: 'projectalpha-production',
  displayName: 'ProjectAlpha Production',
  description: 'GCP에서 운영되는 ProjectAlpha 환경',
  environment: 'production',
  provider: 'gcp-secret-manager',
  deploymentProvider: 'github-actions',
  envFileName: 'projectalpha.env',
  instanceName: 'projectalpha-production',
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

const projectbeta: KeyManagementTarget = {
  id: 'projectbeta-production',
  displayName: 'ProjectBeta Production',
  description: 'SSH에서 운영되는 ProjectBeta 환경',
  environment: 'production',
  provider: 'ssh-env-file',
  deploymentProvider: 'ssh-blue-green',
  envFileName: '.env.production',
  instanceName: 'example-instance',
  location: '192.0.2.10',
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
    targets: [projectalpha, projectbeta],
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
    const state = hookState(projectalpha);
    mocks.useKeyManagement.mockReturnValue(state);

    render(<KeyManagementConsole />);

    expect(
      screen.getByRole('heading', {
        name: 'ProjectAlpha Production 환경 변수 운영실',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('GCP Secret Manager')).toBeInTheDocument();
    expect(screen.getByText('SSH blue/green')).toBeInTheDocument();
    expect(screen.getByText('sha256:bbbbbbbbbbbb')).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: /ProjectBeta Production/ }),
    );
    expect(state.selectTarget).toHaveBeenCalledWith('projectbeta-production');
  });

  it('연결할 수 없는 대상은 비밀 공개 동작을 차단한다', () => {
    const unavailable = {
      ...projectbeta,
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
      screen.getByText('ProjectBeta Production 연결 확인 필요'),
    ).toBeInTheDocument();
  });

  it('전용 서버 명령 대상은 관리 가능한 키와 현재 소스 적용 범위를 표시한다', () => {
    const storage: KeyManagementTarget = {
      ...projectbeta,
      id: 'storage-production',
      displayName: 'Storage Production',
      provider: 'ssh-env-command',
      deploymentProvider: 'ssh-env-command',
      envFileName: 'server.env',
      requiredKeys: [
        'MINIO_ACCESS_KEY',
        'MINIO_SECRET_KEY',
        'MINIO_ENDPOINT',
        'MINIO_BUCKET',
      ],
      managedKeys: [
        'MINIO_ACCESS_KEY',
        'MINIO_SECRET_KEY',
        'MINIO_ENDPOINT',
        'MINIO_BUCKET',
      ],
    };
    mocks.useKeyManagement.mockReturnValue({
      ...hookState(storage),
      targets: [projectalpha, projectbeta, storage],
    });
    render(<KeyManagementConsole />);
    expect(screen.getByText('SSH 관리 명령')).toBeInTheDocument();
    expect(screen.getByText('현재 버전에 환경 적용')).toBeInTheDocument();
    expect(
      screen.getByText(
        /관리 가능 키: MINIO_ACCESS_KEY, MINIO_SECRET_KEY, MINIO_ENDPOINT, MINIO_BUCKET/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/현재 실행 중인 소스 버전에 적용합니다/),
    ).toBeInTheDocument();
  });

  it('전체 관리(*) 대상은 키 목록 대신 예약 키 제외 안내와 필수 키를 표시한다', () => {
    const open: KeyManagementTarget = {
      ...projectbeta,
      id: 'open-production',
      displayName: 'Open Production',
      provider: 'ssh-env-command',
      deploymentProvider: 'ssh-env-command',
      envFileName: 'server.env',
      requiredKeys: ['MONGODB_URI', 'JWT_SECRET'],
      managedKeys: ['*'],
    };
    mocks.useKeyManagement.mockReturnValue({
      ...hookState(open),
      targets: [projectalpha, projectbeta, open],
    });
    render(<KeyManagementConsole />);
    expect(
      screen.getByText(/관리 가능 키: 예약 키를 뺀 모든 키/),
    ).toBeInTheDocument();
    expect(
      screen.getByText('필수 키: MONGODB_URI, JWT_SECRET'),
    ).toBeInTheDocument();
  });

  it('이전 API 응답이 잠시 섞여도 잘못된 배포 방식과 undefined를 표시하지 않는다', () => {
    const legacy = {
      ...projectalpha,
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
