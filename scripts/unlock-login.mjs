// 로그인 잠금 비상 해제. 공격으로 계정이 잠기거나 내 IP 가 막혀 화면에 들어갈 수 없을 때 호스트에서 푼다.
// HTTP 로 열지 않는다. 잠긴 관리자도 DB 에 닿는 호스트에서는 실행할 수 있어야 하기 때문이다.
//
//   node --env-file=.env scripts/unlock-login.mjs <계정 이메일 | IP | IPv6 /64 대역>
//
// 계정: 잠금 판정에 쓰는 최근 30분의 실패 기록을 지운다(모든 출처).
// IP: 그 IP 가 속한 대역의 최근 하루 실패·거절 기록을 지우고 로그인 자동 차단(auto-login)을 만료시킨다.
//     백엔드는 바로 통과시키고, nginx 차단 목록에서는 5분마다 도는 만료 정리 때 빠진다.
// 지운 실패는 감사 기록(audit-log.jsonl)에 남는다. 방화벽 차단 목록은 접속 보안 화면에서 푼다.
// 여러 번 실행해도 결과는 같다.
import { isIP } from 'node:net';
import { Client } from 'pg';

const USAGE =
  '사용법: node --env-file=.env scripts/unlock-login.mjs <계정 이메일 | IP | IPv6 /64 대역>';
const [target, ...rest] = process.argv.slice(2);
if (!target?.trim() || rest.length > 0) {
  console.error(USAGE);
  process.exit(2);
}
const isAccount = target.includes('@');
const address = target.trim();
if (!isAccount && !isIpOrRange(address)) {
  console.error(USAGE);
  process.exit(2);
}
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL 이 없어 실행할 수 없습니다.');
  process.exit(2);
}

function isIpOrRange(value) {
  const [ip, prefix, ...extra] = value.split('/');
  return (
    isIP(ip) !== 0 &&
    extra.length === 0 &&
    (prefix === undefined || /^(0|[1-9]\d{0,2})$/.test(prefix))
  );
}

// 백엔드 normalizeLoginAccount 와 같은 규칙이어야 같은 계정 기록을 찾는다.
function normalizeAccount(email) {
  return email
    .replace(/[\u0000-\u001f\u007f-\u009f‪-‮⁦-⁩]/g, '')
    .trim()
    .toLowerCase()
    .slice(0, 320);
}

async function unlockAccount(client) {
  const account = normalizeAccount(target);
  const cleared = await client.query(
    `DELETE FROM login_attempts
      WHERE account = $1 AND result = 'failure'
        AND created_at > now() - interval '30 minutes'`,
    [account],
  );
  console.log(
    `${account}: 잠금에 쓰이던 실패 기록 ${cleared.rowCount}건을 지웠습니다.`,
  );
}

async function unlockAddress(client) {
  // 실패는 대역(IPv6 /64)으로 세므로, 주소 하나를 받아도 그 주소가 속한 대역 기록까지 푼다.
  const groups = await client.query(
    `SELECT DISTINCT ip_group FROM login_attempts
      WHERE (ip = $1 OR ip_group = $1) AND ip_group IS NOT NULL`,
    [address],
  );
  const keys = [
    ...new Set([address, ...groups.rows.map((row) => row.ip_group)]),
  ];
  const cleared = await client.query(
    `DELETE FROM login_attempts
      WHERE ip_group = ANY($1) AND result <> 'success'
        AND created_at > now() - interval '1 day'`,
    [keys],
  );
  const lifted = await client.query(
    `UPDATE ip_bans SET expires_at = now(), updated_at = now()
      WHERE ip = ANY($1) AND active AND source = 'auto-login'
        AND (expires_at IS NULL OR expires_at > now())`,
    [keys],
  );
  console.log(
    `${keys.join(', ')}: 실패·거절 기록 ${cleared.rowCount}건을 지우고 로그인 자동 차단 ${lifted.rowCount}건을 만료시켰습니다.`,
  );
}

const client = new Client({ connectionString });
await client.connect();
try {
  await client.query('BEGIN');
  if (isAccount) await unlockAccount(client);
  else await unlockAddress(client);
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK').catch(() => undefined);
  throw error;
} finally {
  await client.end();
}
