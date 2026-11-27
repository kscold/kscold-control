import {
  sshGuardPath,
  tailscalePath,
} from '@/system/domain/policies/remote-access.policy';

describe('remote-access.policy', () => {
  it('테일스케일이 Running 이고 온라인이면 쓸 수 있고 키 만료일을 보여 준다', () => {
    const path = tailscalePath({
      BackendState: 'Running',
      Self: { Online: true, KeyExpiry: '2027-05-08T08:01:44Z' },
    });
    expect(path.state).toBe('ok');
    expect(path.detail).toBe('키 만료 2027-05-08');
  });

  it('테일스케일이 Running 이 아니면 끊김으로 본다', () => {
    expect(tailscalePath({ BackendState: 'Stopped' }).state).toBe('down');
  });

  it('차단기 상태가 2분 넘게 안 바뀌면 멈춘 것으로 본다', () => {
    const now = new Date('2026-11-28T01:00:00');
    expect(
      sshGuardPath(
        { updatedAt: '2026-11-28 00:57:00', pfEnabled: true, blockedCount: 3 },
        now,
      ).state,
    ).toBe('down');
    const ok = sshGuardPath(
      { updatedAt: '2026-11-28 00:59:50', pfEnabled: true, blockedCount: 3 },
      now,
    );
    expect(ok.state).toBe('ok');
    expect(ok.detail).toBe('3개 차단 중');
  });

  it('방화벽이 꺼져 있으면 끊김으로 본다', () => {
    const now = new Date('2026-11-28T01:00:00');
    expect(
      sshGuardPath({ updatedAt: '2026-11-28 00:59:50', pfEnabled: false }, now)
        .detail,
    ).toBe('방화벽 꺼짐');
  });
});
