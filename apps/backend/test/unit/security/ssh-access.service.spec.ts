import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { IpAllowlistService } from '@/security/application/services/ip-allowlist.service';
import {
  SshAccessService,
  formatLocal,
} from '@/security/application/services/ssh-access.service';
import { fakeIpGeo, geo } from './ip-geo.fake';

describe('SshAccessService', () => {
  let dir: string;
  let service: SshAccessService;

  beforeEach(async () => {
    dir = await fs.mkdtemp(join(tmpdir(), 'ssh-access-'));
    process.env.SSH_AUDIT_DIR = dir;
    service = new SshAccessService(new IpAllowlistService(), fakeIpGeo());
  });

  afterEach(async () => {
    delete process.env.SSH_AUDIT_DIR;
    await fs.rm(dir, { recursive: true, force: true });
  });

  const read = (name: string) =>
    fs.readFile(join(dir, name), 'utf8').catch(() => '');

  it('기록·차단 목록을 읽어 최신 순으로 돌려준다', async () => {
    const now = formatLocal(new Date());
    const old = formatLocal(new Date(Date.now() - 30 * 86_400_000));
    await fs.writeFile(
      join(dir, 'ssh-audit.log'),
      [
        [old, '실패', 'root', '8.8.8.8', 'password', ''].join('\t'),
        [now, '실패', 'root', '222.99.122.102', 'password', ''].join('\t'),
        [now, '성공', 'kscold', '203.0.113.10', 'password', ''].join('\t'),
      ].join('\n') + '\n',
    );
    await fs.writeFile(
      join(dir, 'ssh-block-auto.tsv'),
      `222.99.122.102\t${now}\t-\troot 시도\n`,
    );

    const o = await service.overview(7);

    expect(o.recorder.exists).toBe(true);
    expect(o.events.map((e) => e.ip)).toEqual([
      '203.0.113.10',
      '222.99.122.102',
    ]);
    expect(o.blocks).toEqual([
      {
        ip: '222.99.122.102',
        source: 'auto',
        blockedAt: now,
        reason: 'root 시도',
        scope: 'all',
        geo: null,
      },
    ]);
    expect(o.guard.running).toBe(false);
  });

  it('외부 IP 요약과 차단 목록에만 나라·도시를 붙인다', async () => {
    const tokyo = geo('JP', '일본', '도쿄');
    service = new SshAccessService(
      new IpAllowlistService(),
      fakeIpGeo({ '203.0.113.7': tokyo, '198.51.100.0': geo('US', '미국') }),
    );
    const now = formatLocal(new Date());
    await fs.writeFile(
      join(dir, 'ssh-audit.log'),
      [
        [now, '실패', 'root', '203.0.113.7', 'password', ''].join('\t'),
        [now, '실패', 'root', '10.0.0.4', 'password', ''].join('\t'),
      ].join('\n') + '\n',
    );
    await fs.writeFile(
      join(dir, 'ssh-block-manual.txt'),
      `198.51.100.0/24\t${now}\t대역\n`,
    );

    const o = await service.overview(7);

    expect(o.summary.ips.map((r) => [r.ip, r.geo?.city ?? null])).toEqual([
      ['203.0.113.7', '도쿄'],
      ['10.0.0.4', null],
    ]);
    expect(o.blocks.map((b) => b.geo?.country)).toEqual(['US']);
    expect((await service.firewallBlocks()).items[0].geo?.country).toBe('US');
  });

  it('외부 IP 만 손으로 막고, 해제는 수동은 지우고 자동은 차단기에 요청한다', async () => {
    await expect(service.block('192.168.0.5', null)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.block('100.100.1.2', null)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    await service.block('5.5.5.5', '이상한\t접속');
    expect(await read('ssh-block-manual.txt')).toMatch(
      /^5\.5\.5\.5\t.+\t이상한 접속\n$/,
    );

    await fs.writeFile(
      join(dir, 'ssh-block-auto.tsv'),
      '6.6.6.6\t2026-11-10 17:00:00\t-\troot\n',
    );
    expect(await service.unblock('5.5.5.5')).toEqual({
      ip: '5.5.5.5',
      released: ['manual'],
    });
    expect(await read('ssh-block-manual.txt')).toBe('');
    expect(await service.unblock('6.6.6.6')).toEqual({
      ip: '6.6.6.6',
      released: ['auto'],
    });
    expect(await read('ssh-block-release.txt')).toBe('6.6.6.6\n');
    // 해제 요청 중인 자동 차단은 목록에서 바로 빠진다
    expect((await service.overview(7)).blocks).toEqual([]);
    await expect(service.unblock('7.7.7.7')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('내 IP 로 표시하면 막을 수 없고 자동 차단 해제도 요청한다', async () => {
    await service.addKnownIp('203.0.113.10');
    await service.addKnownIp('203.0.113.10');
    expect(await read('ssh-known-ips.txt')).toBe('203.0.113.10\n');
    expect(await read('ssh-block-release.txt')).toContain('203.0.113.10');
    await expect(service.block('203.0.113.10', null)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(await service.removeKnownIp('203.0.113.10')).toEqual([]);
    await expect(service.addKnownIp('not-an-ip')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('차단 범위를 SSH 만·모든 접속으로 바꾸고 해제하면 범위 기록도 지운다', async () => {
    await service.block('5.5.5.5', null, 'ssh');
    expect(await read('ssh-block-scope.tsv')).toBe('5.5.5.5\tssh\n');
    await fs.writeFile(
      join(dir, 'ssh-block-auto.tsv'),
      '6.6.6.6\t2026-11-10 17:00:00\t-\troot\n',
    );
    expect((await service.setBlockScope('6.6.6.6', 'ssh')).scope).toBe('ssh');
    const scopes = Object.fromEntries(
      (await service.overview(7)).blocks.map((b) => [b.ip, b.scope]),
    );
    expect(scopes).toEqual({ '5.5.5.5': 'ssh', '6.6.6.6': 'ssh' });
    const fw = await service.firewallBlocks();
    expect(fw.items.map((b) => b.ip).sort()).toEqual(['5.5.5.5', '6.6.6.6']);
    expect(fw.guard.running).toBe(false);

    await service.setBlockScope('6.6.6.6', 'all');
    await service.unblock('5.5.5.5');
    expect(await read('ssh-block-scope.tsv')).toBe('');
    await expect(
      service.setBlockScope('7.7.7.7', 'ssh'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('내 IP 별칭을 남기고, 다른 IP 를 바꿔도 별칭이 지워지지 않는다', async () => {
    await fs.writeFile(
      join(dir, 'ssh-known-ips.txt'),
      '# 메모\n203.0.113.10\t회사\n203.0.113.20 집\n',
    );
    await service.addKnownIp('198.51.100.7');
    await service.setKnownIpLabel('198.51.100.7', '휴대폰\t테더링');
    expect(await read('ssh-known-ips.txt')).toBe(
      '203.0.113.10\t회사\n203.0.113.20\t집\n198.51.100.7\t휴대폰 테더링\n',
    );
    const o = await service.overview(7);
    expect(o.knownIps).toEqual([
      { ip: '203.0.113.10', label: '회사' },
      { ip: '203.0.113.20', label: '집' },
      { ip: '198.51.100.7', label: '휴대폰 테더링' },
    ]);
    await service.setKnownIpLabel('198.51.100.7', null);
    expect(await service.removeKnownIp('203.0.113.10')).toEqual([
      { ip: '203.0.113.20', label: '집' },
      { ip: '198.51.100.7', label: null },
    ]);
    await expect(
      service.setKnownIpLabel('9.9.9.9', 'x'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('목록에 없는 프로세스는 끊지 않는다', async () => {
    await expect(service.terminateSession(process.pid)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('동시에 등록한 내 IP를 빠짐없이 보존한다', async () => {
    const addresses = ['203.0.113.11', '203.0.113.12', '203.0.113.13'];
    await Promise.all(addresses.map((ip) => service.addKnownIp(ip)));
    expect((await read('ssh-known-ips.txt')).trim().split('\n').sort()).toEqual(
      addresses,
    );
    expect(
      (await fs.readdir(dir)).filter((name) => name.endsWith('.tmp')),
    ).toEqual([]);
  });

  it('너무 넓은 대역이나 내부망·허용 목록·내 IP 를 덮는 대역은 방화벽 목록에 쓰지 않는다', async () => {
    process.env.SECURITY_ALLOWLIST = '198.51.100.0/28';
    service = new SshAccessService(new IpAllowlistService(), fakeIpGeo());
    delete process.env.SECURITY_ALLOWLIST;
    await service.addKnownIp('2001:db8:9:9::10');

    for (const target of [
      '0.0.0.0/0',
      '::/0',
      '203.0.113.0/23',
      '2001:db8::/47',
      '10.0.0.0/24',
      '172.16.5.0/24',
      '100.64.0.0/24',
      '127.0.0.1',
      'fd00::/48',
      '198.51.100.0/24',
      '2001:db8:9::/48',
      '2001:db8:9:9::/64',
    ]) {
      await expect(service.block(target, null)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    }
    expect(await read('ssh-block-manual.txt')).toBe('');

    await service.block('203.0.113.0/24', null);
    await service.block('2001:db8:5:6::/64', null);
    expect(
      (await read('ssh-block-manual.txt'))
        .trim()
        .split('\n')
        .map((line) => line.split('\t')[0]),
    ).toEqual(['203.0.113.0/24', '2001:db8:5:6::/64']);
  });

  it('예전에 넓게 적은 방화벽 항목도 풀 수 있다', async () => {
    await fs.writeFile(
      join(dir, 'ssh-block-manual.txt'),
      '203.0.0.0/8\t2026-11-10 17:00:00\t\n',
    );

    expect(await service.unblock('203.0.0.0/8')).toEqual({
      ip: '203.0.0.0/8',
      released: ['manual'],
    });
  });

  it('동일 IP 차단을 중복 기록하지 않고 실패 후에도 다음 변경을 처리한다', async () => {
    await expect(service.block('invalid', null)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await Promise.all([
      service.block('203.0.113.20', null),
      service.block('203.0.113.20', null),
    ]);
    expect(
      (await read('ssh-block-manual.txt')).trim().split('\n'),
    ).toHaveLength(1);
  });
});
