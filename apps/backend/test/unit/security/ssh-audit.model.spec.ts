import {
  classifySshIp,
  parseRemoteEndpoint,
  parseSshAuditLine,
  parseSshSessionCommand,
  summarizeSshAudit,
} from '@/security/domain/ssh-audit/ssh-audit.model';

const line = (...cols: string[]) => cols.join('\t');

describe('ssh-audit model', () => {
  it('기록 한 줄을 해석하고 빈 칸(-)은 null 로 바꾼다', () => {
    const e = parseSshAuditLine(
      line(
        '2026-11-10 17:51:49',
        '없는계정',
        'wangxl',
        '192.253.248.223',
        '-',
        'Invalid user wangxl',
      ),
    );
    expect(e).toMatchObject({
      result: '없는계정',
      user: 'wangxl',
      ip: '192.253.248.223',
      method: null,
      scope: 'external',
    });
    expect(parseSshAuditLine('깨진 줄')).toBeNull();
    expect(
      parseSshAuditLine(line('2026-11-10 17:51:49', '모름', '-', '-', '-', '')),
    ).toBeNull();
  });

  it('IP 출처를 요약 스크립트와 같은 기준으로 나눈다', () => {
    expect(classifySshIp('127.0.0.1')).toBe('local');
    expect(classifySshIp('::1')).toBe('local');
    expect(classifySshIp('192.168.0.22')).toBe('lan');
    expect(classifySshIp('100.90.228.44')).toBe('tailscale');
    expect(classifySshIp('100.128.0.1')).toBe('external');
    expect(classifySshIp('1.225.192.81')).toBe('external');
    expect(classifySshIp(null)).toBe('unknown');
  });

  it('처음 보는 외부 성공 IP 를 맨 위로 올리고 내 IP 는 표시한다', () => {
    const events = [
      line(
        '2026-11-10 10:00:00',
        '실패',
        'root',
        '222.99.122.102',
        'password',
        '',
      ),
      line('2026-11-10 10:00:01', '성공', 'kscold', '9.9.9.9', 'password', ''),
      line(
        '2026-11-10 10:00:02',
        '성공',
        'kscold',
        '1.225.192.81',
        'publickey',
        '',
      ),
      line(
        '2026-11-10 10:00:03',
        '성공',
        'kscold',
        '127.0.0.1',
        'password',
        '',
      ),
      line('2026-11-10 10:00:04', '인증중끊김', '-', '-', '-', ''),
    ]
      .map(parseSshAuditLine)
      .filter((e): e is NonNullable<typeof e> => !!e);

    const s = summarizeSshAudit(
      events,
      new Set(['1.225.192.81']),
      '2026-11-03 00:00:00',
    );

    expect(s.externalSuccess).toBe(2);
    expect(s.externalFailure).toBe(1);
    expect(s.unknownExternalSuccessIps).toBe(1);
    expect(s.ips[0]).toMatchObject({ ip: '9.9.9.9', known: false, success: 1 });
    expect(s.ips.find((r) => r.ip === '1.225.192.81')?.known).toBe(true);
    expect(s.triedUsers).toEqual([{ user: 'root', count: 1 }]);
  });

  it('인증을 마친 세션 프로세스만 세션으로 본다', () => {
    expect(parseSshSessionCommand('sshd-session: kscold@notty')).toEqual({
      user: 'kscold',
      tty: null,
    });
    expect(parseSshSessionCommand('sshd-session: kscold@ttys003')).toEqual({
      user: 'kscold',
      tty: 'ttys003',
    });
    expect(parseSshSessionCommand('sshd-session: kscold')).toEqual({
      user: 'kscold',
      tty: null,
    });
    expect(parseSshSessionCommand('sshd-session: kscold [priv]')).toBeNull();
    expect(parseSshSessionCommand('/usr/sbin/sshd -i')).toBeNull();
  });

  it('lsof 주소에서 원격 IP·포트를 뽑는다', () => {
    expect(parseRemoteEndpoint('192.168.0.88:22->1.225.192.81:62297')).toEqual({
      ip: '1.225.192.81',
      port: 62297,
    });
    expect(parseRemoteEndpoint('[::1]:22->[::1]:5000')).toEqual({
      ip: '::1',
      port: 5000,
    });
    expect(parseRemoteEndpoint('*:22')).toBeNull();
  });
});
