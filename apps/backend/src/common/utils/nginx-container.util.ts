/**
 * 관리할 nginx 컨테이너 이름. 비워 두면 nginx 연동을 끈다
 * (설치 프로그램으로 깐 Control 처럼 다른 사람의 nginx 가 없는 환경).
 */
export function resolveNginxContainer(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const configured = env.NGINX_CONTAINER;
  if (configured === undefined) return 'kscold-nginx';
  return configured.trim() || null;
}
