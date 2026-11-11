import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AttackMapService } from '@/security/application/services/attack-map.service';
import { IpAllowlistService } from '@/security/application/services/ip-allowlist.service';
import {
  SshAccessService,
  formatLocal,
} from '@/security/application/services/ssh-access.service';
import type { IIpGeoReader } from '@/security/domain/repositories/ip-geo.reader';
import {
  InMemoryIpBanRepository,
  InMemoryLoginAttemptRepository,
} from './login-guard.fake';
import { fakeIpGeo, geo } from './ip-geo.fake';

describe('AttackMapService', () => {
  let dir: string;
  let attempts: InMemoryLoginAttemptRepository;
  let bans: InMemoryIpBanRepository;

  const service = (reader: IIpGeoReader) =>
    new AttackMapService(
      new SshAccessService(new IpAllowlistService(), reader),
      attempts,
      bans,
      reader,
    );

  beforeEach(async () => {
    dir = await fs.mkdtemp(join(tmpdir(), 'attack-map-'));
    process.env.SSH_AUDIT_DIR = dir;
    attempts = new InMemoryLoginAttemptRepository();
    bans = new InMemoryIpBanRepository();
  });

  afterEach(async () => {
    delete process.env.SSH_AUDIT_DIR;
    await fs.rm(dir, { recursive: true, force: true });
  });

  const writeLog = (rows: string[][]) =>
    fs.writeFile(
      join(dir, 'ssh-audit.log'),
      rows.map((r) => r.join('\t')).join('\n') + '\n',
    );

  const webFailure = (ip: string, at = new Date()) =>
    attempts.append({
      ip,
      ipGroup: ip,
      account: 'admin@example.com',
      origin: 'external',
      result: 'failure',
      reason: 'wrong-password',
      at,
    });

  it('IP 위치 파일이 없으면 지도를 끄고 이유를 알려 준다', async () => {
    await expect(service(fakeIpGeo()).attackMap(7)).resolves.toEqual({
      enabled: false,
      reason: 'off',
    });
  });

  it('SSH 와 웹 로그인 실패를 IP 별로 합치고 나라별로 묶는다', async () => {
    const now = formatLocal(new Date());
    await writeLog([
      [now, '실패', 'root', '203.0.113.7', 'password', ''],
      [now, '없는계정', 'admin', '203.0.113.7', 'password', ''],
      [now, '실패', 'root', '203.0.113.8', 'password', ''],
      [now, '실패', 'root', '198.51.100.9', 'password', ''],
      [now, '실패', 'root', '10.0.0.4', 'password', ''],
      [now, '성공', 'me', '192.0.2.50', 'publickey', ''],
    ]);
    await fs.writeFile(join(dir, 'ssh-known-ips.txt'), '192.0.2.50\t집\n');
    await fs.writeFile(
      join(dir, 'ssh-block-manual.txt'),
      `203.0.113.0/24\t${now}\t대역\n`,
    );
    await webFailure('203.0.113.7');
    await webFailure('198.51.100.20');
    await webFailure('198.51.100.20', new Date(Date.now() - 40 * 86_400_000));
    await bans.create({
      ip: '198.51.100.20',
      reason: null,
      source: 'auto-login',
      expiresAt: null,
      createdBy: null,
    });

    const map = await service(
      fakeIpGeo({
        '203.0.113.7': geo('JP', '일본', '도쿄'),
        '203.0.113.8': geo('JP', '일본', '오사카'),
        '198.51.100.20': geo('US', '미국'),
        '192.0.2.50': geo('KR', '대한민국'),
      }),
    ).attackMap(7);

    if (!map.enabled) throw new Error('지도가 켜져 있어야 함');
    const attemptsInOrder = map.points.map((p) => p.attempts);
    expect(attemptsInOrder).toEqual([...attemptsInOrder].sort((x, y) => y - x));
    expect(
      [...map.points]
        .sort((x, y) => x.ip.localeCompare(y.ip))
        .map((p) => [
          p.ip,
          p.ssh.failures,
          p.web.failures,
          p.attempts,
          p.blocked,
          p.geo?.city ?? null,
        ]),
    ).toEqual([
      ['198.51.100.20', 0, 1, 1, true, null],
      ['198.51.100.9', 1, 0, 1, false, null],
      ['203.0.113.7', 2, 1, 3, true, '도쿄'],
      ['203.0.113.8', 1, 0, 1, true, '오사카'],
    ]);
    expect(
      map.countries.map((c) => [c.country, c.attempts, c.ips, c.blockedIps]),
    ).toEqual([
      ['JP', 4, 2, 2],
      ['US', 1, 1, 1],
      [null, 1, 1, 0],
    ]);
  });
});
