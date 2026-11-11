import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AuditLogService } from '@/audit/application/services/audit-log.service';
import type { CreateAuditEventInput } from '@/audit/domain/types/audit-event.type';
import { IpAllowlistService } from '@/security/application/services/ip-allowlist.service';
import { LoginGuardService } from '@/security/application/services/login-guard.service';
import { SshAccessService } from '@/security/application/services/ssh-access.service';
import { CreateIpBanUseCase } from '@/security/application/use-cases/create-ip-ban.use-case';
import { ResyncBlocklistUseCase } from '@/security/application/use-cases/resync-blocklist.use-case';
import type { IpBan } from '@/security/domain/entities/ip-ban.entity';
import type {
  LoginAttemptRecord,
  LoginOrigin,
} from '@/security/domain/login-guard/login-block.policy';
import type {
  CreateIpBanInput,
  IIpBanRepository,
} from '@/security/domain/repositories/ip-ban.repository';
import type { ILoginAttemptRepository } from '@/security/domain/repositories/login-attempt.repository';
import type { INginxBlocklistWriter } from '@/security/domain/repositories/nginx-blocklist.writer';

/** SQL 저장소와 같은 조건으로 기록을 고른다. */
export class InMemoryLoginAttemptRepository implements ILoginAttemptRepository {
  readonly rows: LoginAttemptRecord[] = [];

  async append(row: LoginAttemptRecord) {
    this.rows.push({ ...row });
  }

  async recent(query: {
    ipGroup: string | null;
    ipSince: Date;
    account: string;
    origin: LoginOrigin;
    accountSince: Date;
  }) {
    return this.rows
      .filter(
        (row) =>
          (query.ipGroup !== null &&
            row.ipGroup === query.ipGroup &&
            row.at > query.ipSince &&
            row.result !== 'success') ||
          (row.account === query.account &&
            row.origin === query.origin &&
            row.at > query.accountSince &&
            row.result === 'failure'),
      )
      .map((row) => ({ ...row }));
  }

  async deleteBefore(cutoff: Date) {
    const before = this.rows.length;
    const kept = this.rows.filter((row) => row.at >= cutoff);
    this.rows.splice(0, this.rows.length, ...kept);
    return before - kept.length;
  }
}

export class InMemoryIpBanRepository implements IIpBanRepository {
  readonly rows = new Map<string, IpBan>();

  async list() {
    return [...this.rows.values()];
  }
  async listActive() {
    return [...this.rows.values()].filter((ban) => ban.active);
  }
  async findByIp(ip: string) {
    return this.rows.get(ip) ?? null;
  }
  async findById(id: string) {
    return [...this.rows.values()].find((ban) => ban.id === id) ?? null;
  }
  async create(input: CreateIpBanInput) {
    const now = new Date();
    const ban: IpBan = {
      id: `ban-${this.rows.size + 1}`,
      ...input,
      active: true,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.set(input.ip, ban);
    return ban;
  }
  async deactivate(id: string) {
    const ban = await this.findById(id);
    if (ban) ban.active = false;
    return ban;
  }
  async removeExpired() {
    return [];
  }
  async deleteExpiredBefore(cutoff: Date) {
    let removed = 0;
    for (const [ip, ban] of this.rows) {
      if (!ban.active && ban.expiresAt && ban.expiresAt < cutoff) {
        this.rows.delete(ip);
        removed++;
      }
    }
    return removed;
  }
}

/** nginx 를 건드리지 않고, 적용하려던 차단 목록만 남긴다. */
export class RecordingBlocklistWriter implements INginxBlocklistWriter {
  readonly applied: string[][] = [];
  async apply(ips: string[]) {
    this.applied.push([...ips]);
    return { reloaded: false, output: 'test' };
  }
}

/** allowlist 는 SECURITY_ALLOWLIST 값이다. 기동할 때 한 번 읽으므로 만들 때 넘긴다. */
export async function loginGuardHarness(options: { allowlist?: string } = {}) {
  const sshDir = await fs.mkdtemp(join(tmpdir(), 'login-guard-'));
  process.env.SSH_AUDIT_DIR = sshDir;
  const attempts = new InMemoryLoginAttemptRepository();
  const ipBans = new InMemoryIpBanRepository();
  const nginx = new RecordingBlocklistWriter();
  const audits: CreateAuditEventInput[] = [];
  const audit = {
    record: async (input: CreateAuditEventInput) => {
      audits.push(input);
    },
  } as unknown as AuditLogService;
  const previousAllowlist = process.env.SECURITY_ALLOWLIST;
  process.env.SECURITY_ALLOWLIST = options.allowlist ?? '';
  const allowlist = new IpAllowlistService();
  if (previousAllowlist === undefined) delete process.env.SECURITY_ALLOWLIST;
  else process.env.SECURITY_ALLOWLIST = previousAllowlist;
  const sshAccess = new SshAccessService();
  const resync = new ResyncBlocklistUseCase(ipBans, nginx);
  const guard = new LoginGuardService(
    attempts,
    ipBans,
    new CreateIpBanUseCase(ipBans, allowlist, resync),
    allowlist,
    sshAccess,
    audit,
  );

  return {
    guard,
    attempts,
    ipBans,
    nginx,
    resync,
    audits,
    sshDir,
    firewallEntries: async () =>
      (
        await fs
          .readFile(join(sshDir, 'ssh-block-manual.txt'), 'utf8')
          .catch(() => '')
      )
        .split('\n')
        .filter(Boolean)
        .map((line) => line.split('\t')),
    addKnownIp: (ip: string) => sshAccess.addKnownIp(ip),
    cleanup: async () => {
      resync.onModuleDestroy();
      delete process.env.SSH_AUDIT_DIR;
      await fs.rm(sshDir, { recursive: true, force: true });
    },
  };
}
