/**
 * 터미널 셸과 AI 에이전트처럼 사람이나 모델이 명령을 고르는 자식 프로세스는
 * 백엔드 환경을 그대로 받으면 `env` 한 번으로 JWT_SECRET·DATABASE_URL 같은
 * 비밀값을 읽는다. 그래서 허용 목록에 있는 이름만 물려주고, 그 밖에 꼭 필요한
 * 값(에이전트 자신의 API 키 등)은 호출하는 쪽이 extra 로 이름을 밝혀 넘긴다.
 */
const INHERITED_ENV_KEYS = new Set([
  'PATH',
  'HOME',
  'USER',
  'LOGNAME',
  'SHELL',
  'LANG',
  'TERM',
  'TMPDIR',
  'TZ',
  // 터미널과 에이전트가 docker 명령을 쓸 때 colima 소켓을 찾는 경로다. 비밀값이 아니다.
  'DOCKER_HOST',
]);

const INHERITED_ENV_PREFIXES = ['LC_'];

function isInherited(key: string): boolean {
  return (
    INHERITED_ENV_KEYS.has(key) ||
    INHERITED_ENV_PREFIXES.some((prefix) => key.startsWith(prefix))
  );
}

export function childProcessEnv(
  base: NodeJS.ProcessEnv,
  extra: Record<string, string | undefined> = {},
): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(base)) {
    if (value !== undefined && isInherited(key)) env[key] = value;
  }
  for (const [key, value] of Object.entries(extra)) {
    if (value !== undefined) env[key] = value;
  }
  return env;
}
