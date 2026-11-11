// 2단계 인증 비상 해제. OTP 기기와 복구 코드를 모두 잃은 계정을 호스트에서만 되살린다.
// HTTP 로는 열지 않는다. DB 에 닿을 수 있는 사람만 실행할 수 있어야 하기 때문이다.
//
//   node --env-file=.env scripts/reset-user-mfa.mjs <email>
//
// 등록한 OTP 와 남은 복구 코드를 지우고 그 계정의 로그인 세션을 모두 끊는다.
// 다음 로그인에서 필수 역할 계정은 등록 화면으로 간다. 여러 번 실행해도 결과는 같다.
import { Client } from 'pg';

const [email, ...rest] = process.argv.slice(2);
if (!email || rest.length > 0) {
  console.error(
    '사용법: node --env-file=.env scripts/reset-user-mfa.mjs <email>',
  );
  process.exit(2);
}
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL 이 없어 실행할 수 없습니다.');
  process.exit(2);
}

const client = new Client({ connectionString });
await client.connect();
try {
  await client.query('BEGIN');
  const users = await client.query(
    'SELECT id, email FROM users WHERE lower(email) = lower($1)',
    [email.trim()],
  );
  if (users.rowCount !== 1) {
    await client.query('ROLLBACK');
    console.error(`계정을 찾지 못했습니다: ${email}`);
    process.exitCode = 1;
  } else {
    const user = users.rows[0];
    const cleared = await client.query(
      'DELETE FROM user_mfa WHERE user_id = $1',
      [user.id],
    );
    const revoked = await client.query(
      `UPDATE auth_sessions SET revoked_at = now()
        WHERE revoked_at IS NULL
          AND (user_id = $1
            OR parent_session_id IN (SELECT id FROM auth_sessions WHERE user_id = $1))`,
      [user.id],
    );
    await client.query('COMMIT');
    console.log(
      `${user.email}: 2단계 인증 ${cleared.rowCount ? '해제' : '등록 없음'}, 끊은 세션 ${revoked.rowCount}개`,
    );
  }
} catch (error) {
  await client.query('ROLLBACK').catch(() => undefined);
  throw error;
} finally {
  await client.end();
}
