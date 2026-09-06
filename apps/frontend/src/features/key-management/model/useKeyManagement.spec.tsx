import { act, renderHook, waitFor } from '@testing-library/react';
import { keyManagementService } from '../api/key-management.service';
import type { KeyManagementTarget } from './types';
import { useKeyManagement } from './useKeyManagement';

const gole: KeyManagementTarget = {
  id: 'gole-production',
  displayName: 'GoLe Production',
  description: 'GoLe target',
  environment: 'production',
  provider: 'gcp-secret-manager',
  deploymentProvider: 'github-actions',
  envFileName: 'gole.env',
  instanceName: 'gole-production',
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

const pawpong: KeyManagementTarget = {
  ...gole,
  id: 'pawpong-production',
  displayName: 'Pawpong Production',
  provider: 'ssh-env-file',
  deploymentProvider: 'ssh-blue-green',
  envFileName: '.env.production',
  instanceName: 'colding-304515',
  location: '115.68.227.188',
  version: 'b'.repeat(64),
};

describe('useKeyManagement target selection', () => {
  beforeEach(() => {
    vi.spyOn(keyManagementService, 'getTargets').mockResolvedValue([
      gole,
      pawpong,
    ]);
    vi.spyOn(keyManagementService, 'getBackups').mockResolvedValue([]);
    vi.spyOn(keyManagementService, 'reveal').mockResolvedValue({
      targetId: gole.id,
      version: gole.version!,
      checksum: gole.checksum!,
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
    expect(result.current.revealed?.targetId).toBe(gole.id);

    await act(async () => {
      await result.current.selectTarget(pawpong.id);
    });

    expect(result.current.target?.id).toBe(pawpong.id);
    expect(result.current.revealed).toBeNull();
    expect(result.current.editorValue).toBe('');
    expect(keyManagementService.getBackups).toHaveBeenLastCalledWith(
      pawpong.id,
    );
  });
});
