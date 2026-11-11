// 로그인 잠금 비상 해제. 공격으로 계정이 잠기거나 내 IP 가 막혀 화면에 들어갈 수 없을 때 호스트에서 푼다.
// HTTP 로 열지 않는다. 잠긴 관리자도 DB 에 닿는 호스트에서는 실행할 수 있어야 하기 때문이다.
//
//   node --env-file=.env scripts/unlock-login.mjs <계정 이메일 | IP | IPv6 /64 대역>
//
// 계정: 잠금 판정에 쓰는 최근 30분의 실패 기록을 지운다(모든 출처).
// IP: 그 IP 가 속한 대역(IPv6 는 /64)의 최근 하루 실패·거절 기록을 지우고 로그인 자동 차단(auto-login)을 만료시킨다.
//     백엔드는 바로 통과시키고, nginx 차단 목록에서는 5분마다 도는 만료 정리 때 빠진다.
// 해제한 일은 백엔드와 같은 감사 기록(apps/backend/data/audit-log.jsonl)에 남긴다. 저장소 루트에서 실행한다.
// 방화벽 차단 목록은 읽기만 하고 남아 있으면 알려 준다. 그 파일은 실행 중인 백엔드가 차례를 세워 고쳐 쓰므로
// 여기서 함께 쓰면 한쪽 변경이 사라질 수 있다. 접속 보안 화면에서 푼다.
// 여러 번 실행해도 결과는 같다.
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { homedir, userInfo } from 'node:os';
import { dirname, join } from 'node:path';
import { Client } from 'pg';
import {
  auditLogPath,
  firewallEntriesFor,
  normalizeLoginAccount,
  unlockAuditLine,
  unlockGroup,
} from './lib/login-unlock.mjs';

const USAGE =
  '사용법: node --env-file=.env scripts/unlock-login.mjs <계정 이메일 | IP | IPv6 /64 대역>';
const [target, ...rest] = process.argv.slice(2);
if (!target?.trim() || rest.length > 0) {
  console.error(USAGE);
  process.exit(2);
}
const isAccount = target.includes('@');
const group = isAccount ? null : unlockGroup(target);
if (!isAccount && !group) {
  console.error(USAGE);
  process.exit(2);
}
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL 이 없어 실행할 수 없습니다.');
  process.exit(2);
}

async function unlockAccount(client) {
  const account = normalizeLoginAccount(target);
  const cleared = await client.query(
    `DELETE FROM login_attempts
      WHERE account = $1 AND result = 'failure'
        AND created_at > now() - interval '30 minutes'`,
    [account],
  );
  return {
    targetType: 'account',
    targetId: account,
    summary: `${account}: 잠금에 쓰이던 실패 기록 ${cleared.rowCount}건을 지웠습니다.`,
    metadata: { clearedAttempts: cleared.rowCount },
  };
}

async function unlockAddress(client) {
  const cleared = await client.query(
    `DELETE FROM login_attempts
      WHERE ip_group = $1 AND result <> 'success'
        AND created_at > now() - interval '1 day'`,
    [group],
  );
  // 백엔드는 자기 시계로 만료를 본다. DB 가 도는 VM 시계가 조금 앞서면 now() 로 적은 만료가 아직 오지 않은 것으로 보이므로, 같은 호스트의 시계로 적는다.
  const lifted = await client.query(
    `UPDATE ip_bans SET expires_at = $2, updated_at = $2
      WHERE ip = $1 AND active AND source = 'auto-login'
        AND (expires_at IS NULL OR expires_at > $2)`,
    [group, new Date()],
  );
  return {
    targetType: 'ip',
    targetId: group,
    summary: `${group}: 실패·거절 기록 ${cleared.rowCount}건을 지우고 로그인 자동 차단 ${lifted.rowCount}건을 만료시켰습니다.`,
    metadata: {
      input: target.trim(),
      clearedAttempts: cleared.rowCount,
      liftedBans: lifted.rowCount,
    },
  };
}

async function readLines(dir, name) {
  try {
    return (await readFile(join(dir, name), 'utf8'))
      .split('\n')
      .map((line) => line.replace(/\r$/, ''))
      .filter((line) => line.trim());
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

// SshAccessService 와 같은 폴더를 읽는다.
async function warnFirewallEntries() {
  const dir = process.env.SSH_AUDIT_DIR || join(homedir(), 'server-watchdog');
  const [manual, auto, release] = await Promise.all(
    ['ssh-block-manual.txt', 'ssh-block-auto.tsv', 'ssh-block-release.txt'].map(
      (name) => readLines(dir, name),
    ),
  );
  const hits = firewallEntriesFor(group, { manual, auto, release });
  if (hits.length === 0) return;
  const listed = hits
    .map((hit) => `${hit.ip}(${hit.source === 'manual' ? '수동' : '자동'})`)
    .join(', ');
  console.log(
    `호스트 방화벽 차단 목록에도 ${listed} 이(가) 남아 있습니다. 접속 보안 화면에서 풀어 주세요.`,
  );
}

const client = new Client({ connectionString });
await client.connect();
let result;
try {
  await client.query('BEGIN');
  result = isAccount
    ? await unlockAccount(client)
    : await unlockAddress(client);
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK').catch(() => undefined);
  throw error;
} finally {
  await client.end();
}
console.log(result.summary);

const auditPath = auditLogPath(process.cwd());
try {
  await mkdir(dirname(auditPath), { recursive: true });
  await appendFile(
    auditPath,
    unlockAuditLine({
      ...result,
      metadata: {
        ...result.metadata,
        tool: 'scripts/unlock-login.mjs',
        hostUser: userInfo().username,
      },
    }),
    'utf8',
  );
} catch (error) {
  console.error(
    `해제는 끝났지만 감사 기록(${auditPath})에 남기지 못했습니다: ${error.message}`,
  );
  process.exitCode = 1;
}

if (!isAccount) await warnFirewallEntries();
