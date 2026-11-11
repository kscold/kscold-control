import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AuditLogService } from '@/audit/application/services/audit-log.service';
import type { CreateAuditEventInput } from '@/audit/domain/types/audit-event.type';
import { IpAllowlistService } from '@/security/application/services/ip-allowlist.service';
import {
  SshAccessService,
  formatLocal,
} from '@/security/application/services/ssh-access.service';
import { SshCountryGuardService } from '@/security/application/services/ssh-country-guard.service';
import type {
  IIpGeoReader,
  IpGeoStatus,
} from '@/security/domain/repositories/ip-geo.reader';
import { fakeIpGeo, geo } from './ip-geo.fake';

const US = '203.0.113.10';
const CN = '203.0.113.20';
const KR = '198.51.100.30';
const UNLOCATED = '198.51.100.40';

const GEO = {
  [US]: geo('US', '미국'),
  [CN]: geo('CN', '중국'),
  [KR]: geo('KR', '대한민국'),
};

describe('SshCountryGuardService', () => {
  let dir: string;
  let audits: CreateAuditEventInput[];

  beforeEach(async () => {
    dir = await fs.mkdtemp(join(tmpdir(), 'ssh-country-'));
    process.env.SSH_AUDIT_DIR = dir;
    audits = [];
  });

  afterEach(async () => {
    delete process.env.SSH_AUDIT_DIR;
    await fs.rm(dir, { recursive: true, force: true });
  });

  const setup = (reader: IIpGeoReader = fakeIpGeo(GEO)) => {
    const ssh = new SshAccessService(new IpAllowlistService(), reader);
    const audit = {
      record: (input: CreateAuditEventInput) => {
        audits.push(input);
        return Promise.resolve();
      },
    } as unknown as AuditLogService;
    const guard = new SshCountryGuardService(
      ssh,
      new IpAllowlistService(),
      reader,
      audit,
    );
    return { ssh, guard };
  };

  const line = (result: string, user: string, ip: string) =>
    [formatLocal(new Date()), result, user, ip, 'password', ''].join('\t');

  const appendLog = (...lines: string[]) =>
    fs.appendFile(join(dir, 'ssh-audit.log'), lines.join('\n') + '\n');

  const blocks = async (ssh: SshAccessService) =>
    (await ssh.firewallBlocks()).items.map((b) => ({
      ip: b.ip,
      scope: b.scope,
      reason: b.reason,
    }));

  it('허용 국가 밖에서 접속만 하면 SSH 만 막고, 다시 돌아도 한 번만 막는다', async () => {
    const { ssh, guard } = setup();
    await appendLog(line('인증중끊김', 'deploy', US));

    await guard.run();
    await guard.run();
    // 다시 띄우면 최근 7일을 다시 본다
    await setup().guard.run();

    expect(await blocks(ssh)).toEqual([
      {
        ip: US,
        scope: 'ssh',
        reason: '허용 국가 밖 SSH 접속 (US, user=deploy)',
      },
    ]);
    expect(audits.map((a) => a.action)).toEqual(['ssh.country-block']);
  });

  it('비밀번호 실패나 root 시도는 공격으로 보고 SSH·사이트 모두 막는다', async () => {
    const { ssh, guard } = setup();
    await appendLog(line('실패', 'admin', US), line('인증중끊김', 'root', CN));

    await guard.run();

    expect(await blocks(ssh)).toEqual(
      expect.arrayContaining([
        {
          ip: US,
          scope: 'all',
          reason: '허용 국가 밖 SSH 공격 (US, user=admin)',
        },
        {
          ip: CN,
          scope: 'all',
          reason: '허용 국가 밖 SSH 공격 (CN, user=root)',
        },
      ]),
    );
  });

  it('SSH 만 막던 IP 가 나중에 공격하면 모든 접속으로 넓힌다', async () => {
    const { ssh, guard } = setup();
    await appendLog(line('인증중끊김', 'deploy', US));
    await guard.run();

    await appendLog(line('없는계정', 'oracle', US));
    await guard.run();

    expect(await blocks(ssh)).toEqual([
      {
        ip: US,
        scope: 'all',
        reason: '허용 국가 밖 SSH 공격 (US, user=oracle)',
      },
    ]);
    expect(audits.map((a) => a.action)).toEqual([
      'ssh.country-block',
      'ssh.country-block.widen',
    ]);
  });

  it('허용 국가 밖에서 로그인이 성공하면 막고 침입으로 감사 기록을 남긴다', async () => {
    const { ssh, guard } = setup();
    await appendLog(line('성공', 'operator', US));

    await guard.run();

    expect(await blocks(ssh)).toEqual([
      {
        ip: US,
        scope: 'ssh',
        reason: '허용 국가 밖 SSH 접속 (US, user=operator)',
      },
    ]);
    expect(audits).toEqual([
      expect.objectContaining({
        action: 'ssh.country-intrusion',
        targetId: US,
        metadata: expect.objectContaining({ succeeded: true, country: 'US' }),
      }),
    ]);
  });

  it('허용 국가·내 IP·위치를 모르는 IP·내부망은 막지 않는다', async () => {
    const { ssh, guard } = setup();
    await fs.writeFile(join(dir, 'ssh-known-ips.txt'), `${CN}\t출장\n`);
    await appendLog(
      line('실패', 'root', KR),
      line('실패', 'root', CN),
      line('실패', 'root', UNLOCATED),
      line('실패', 'root', '10.0.0.5'),
    );

    await guard.run();

    expect(await blocks(ssh)).toEqual([]);
  });

  it('다른 규칙이 이미 막은 IP 는 범위를 바꾸지 않는다', async () => {
    const { ssh, guard } = setup();
    await ssh.block(US, '손으로 막음', 'ssh');
    await appendLog(line('실패', 'root', US));

    await guard.run();

    expect(await blocks(ssh)).toEqual([
      { ip: US, scope: 'ssh', reason: '손으로 막음' },
    ]);
  });

  it.each<IpGeoStatus>([{ state: 'off' }, { state: 'loading' }])(
    'IP 위치 조회가 준비되지 않으면($state) 아무것도 하지 않는다',
    async (status) => {
      const { ssh, guard } = setup({
        status: () => status,
        lookup: () => null,
      });
      await appendLog(line('실패', 'root', US));

      await guard.run();

      expect(await blocks(ssh)).toEqual([]);
    },
  );

  it('꺼 두면 막지 않고, 다시 켜면 최근 7일을 다시 본다', async () => {
    const { ssh, guard } = setup();
    await guard.update({ enabled: false });
    await appendLog(line('실패', 'root', US));
    await guard.run();
    expect(await blocks(ssh)).toEqual([]);

    await guard.update({ enabled: true });
    await guard.run();

    expect((await blocks(ssh)).map((b) => b.ip)).toEqual([US]);
  });

  it('허용 국가에서 빼면 다음 차례에 막고, 다시 넣어도 저절로 풀지 않으며 나라별로 한 번에 풀 수 있다', async () => {
    const { ssh, guard } = setup();
    await guard.update({ allowedCountries: ['kr', 'us'] });
    await appendLog(line('인증중끊김', 'deploy', US), line('실패', 'root', CN));
    await guard.run();
    expect((await blocks(ssh)).map((b) => b.ip)).toEqual([CN]);

    await guard.update({ allowedCountries: ['KR'] });
    await guard.run();
    await guard.update({ allowedCountries: ['KR', 'US'] });
    await guard.run();

    const status = await guard.status((await ssh.firewallBlocks()).items);
    expect(status).toEqual(
      expect.objectContaining({
        enabled: true,
        state: 'on',
        allowedCountries: ['KR', 'US'],
        blockedByCountry: [
          { country: 'CN', countryName: '중국', count: 1 },
          { country: 'US', countryName: '미국', count: 1 },
        ],
      }),
    );

    await expect(guard.unblockCountry('us')).resolves.toEqual({
      country: 'US',
      released: [US],
    });
    expect((await blocks(ssh)).map((b) => b.ip)).toEqual([CN]);
  });

  it('저장된 설정이 없으면 한국만 허용하고 켜 둔다', async () => {
    const { guard } = setup();
    await expect(guard.settings()).resolves.toEqual({
      enabled: true,
      allowedCountries: ['KR'],
    });
    await expect(guard.update({ allowedCountries: [] })).rejects.toThrow(
      '한 나라 이상',
    );
  });

  it('기록기가 파일을 .1 로 넘겨도 넘기기 전에 붙은 줄을 놓치지 않는다', async () => {
    const { ssh, guard } = setup();
    await appendLog(line('성공', 'operator', KR));
    await guard.run();

    await appendLog(line('실패', 'root', US));
    await fs.rename(join(dir, 'ssh-audit.log'), join(dir, 'ssh-audit.log.1'));
    await appendLog(line('실패', 'root', CN));
    await guard.run();

    expect((await blocks(ssh)).map((b) => b.ip).sort()).toEqual(
      [US, CN].sort(),
    );
  });
});
