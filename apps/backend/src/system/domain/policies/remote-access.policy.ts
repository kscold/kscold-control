import type { RemoteAccessPath } from '../types/remote-access.type';

/** 차단기는 15초마다 상태를 쓴다. 이보다 오래 안 바뀌면 멈춘 것으로 본다. */
export const SSH_GUARD_STALE_MS = 2 * 60 * 1000;

interface TailscaleStatus {
  BackendState?: unknown;
  Self?: { Online?: unknown; KeyExpiry?: unknown };
}

export function tailscalePath(status: TailscaleStatus): RemoteAccessPath {
  const running = status.BackendState === 'Running';
  const online = status.Self?.Online === true;
  const expiry =
    typeof status.Self?.KeyExpiry === 'string'
      ? status.Self.KeyExpiry.slice(0, 10)
      : null;
  return {
    id: 'tailscale',
    label: '테일스케일 SSH',
    state: running && online ? 'ok' : 'down',
    detail:
      running && online
        ? expiry
          ? `키 만료 ${expiry}`
          : null
        : `상태 ${String(status.BackendState ?? '알 수 없음')}`,
  };
}

interface SshGuardStatus {
  updatedAt?: unknown;
  pfEnabled?: unknown;
  blockedCount?: unknown;
}

/** updatedAt 은 차단기가 쓰는 로컬 시각 'YYYY-MM-DD HH:MM:SS' */
export function sshGuardPath(
  status: SshGuardStatus,
  now: Date,
): RemoteAccessPath {
  const updated =
    typeof status.updatedAt === 'string'
      ? new Date(status.updatedAt.replace(' ', 'T'))
      : null;
  const fresh =
    updated !== null &&
    !Number.isNaN(updated.getTime()) &&
    now.getTime() - updated.getTime() < SSH_GUARD_STALE_MS;
  const enabled = status.pfEnabled === true;
  const blocked =
    typeof status.blockedCount === 'number' ? status.blockedCount : null;
  return {
    id: 'ssh-guard',
    label: 'SSH 차단기',
    state: fresh && enabled ? 'ok' : 'down',
    detail: !fresh
      ? '상태가 2분 넘게 갱신되지 않음'
      : !enabled
        ? '방화벽 꺼짐'
        : blocked !== null
          ? `${blocked}개 차단 중`
          : null,
  };
}
