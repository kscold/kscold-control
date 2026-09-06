import { act, renderHook, waitFor } from '@testing-library/react';
import { keyManagementService } from '../api/key-management.service';
import type { KeyManagementTarget } from './types';
import { useKeyManagement } from './useKeyManagement';

const projectalpha: KeyManagementTarget = {
  id: 'projectalpha-production',
  displayName: 'ProjectAlpha Production',
  description: 'ProjectAlpha target',
  environment: 'production',
  provider: 'gcp-secret-manager',
  deploymentProvider: 'github-actions',
  envFileName: 'projectalpha.env',
  instanceName: 'projectalpha-production',
  location: 'GCP',
  requiredKeys: ['NODE_ENV'],
  version: '6',
  updatedAt: null,
  checksum: 'a'.repeat(64),
  keyCount: 1,
  keys: ['NODE_ENV'],
  connectionStatus: 'healthy',
  connectionError: null,
};

const projectbeta: KeyManagementTarget = {
  ...projectalpha,
  id: 'projectbeta-production',
  displayName: 'ProjectBeta Production',
  provider: 'ssh-env-file',
  deploymentProvider: 'ssh-blue-green',
  envFileName: '.env.production',
  instanceName: 'example-instance',
  location: '192.0.2.10',
  version: 'b'.repeat(64),
};

describe('useKeyManagement target selection', () => {
  beforeEach(() => {
    vi.spyOn(keyManagementService, 'getTargets').mockResolvedValue([
      projectalpha,
      projectbeta,
    ]);
    vi.spyOn(keyManagementService, 'getBackups').mockResolvedValue([]);
    vi.spyOn(keyManagementService, 'reveal').mockResolvedValue({
      targetId: projectalpha.id,
      version: projectalpha.version!,
      checksum: projectalpha.checksum!,
      envFile: 'NODE_ENV=production\n',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('대상을 전환할 때 공개된 값과 편집 버퍼를 즉시 지운다', async () => {
    const { result } = renderHook(() => useKeyManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.reveal();
    });
    expect(result.current.revealed?.targetId).toBe(projectalpha.id);

    await act(async () => {
      await result.current.selectTarget(projectbeta.id);
    });

    expect(result.current.target?.id).toBe(projectbeta.id);
    expect(result.current.revealed).toBeNull();
    expect(result.current.editorValue).toBe('');
    expect(keyManagementService.getBackups).toHaveBeenLastCalledWith(
      projectbeta.id,
    );
  });
});
