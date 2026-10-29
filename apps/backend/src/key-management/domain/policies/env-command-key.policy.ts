/**
 * env-v1 강제 명령 대상에서 관리할 수 있는 환경 변수 규칙.
 *
 * 대상 설정의 allowedKeys 가 ['*'] 이면 예약 키를 뺀 모든 키를 받는다.
 * 새 기능 키를 대상 설정이나 서버 도구를 고치지 않고 운영 키 화면에서 바로 넣기 위해서다.
 * 예약 키 목록은 GaDoc 배포 도구(scripts/deploy/deploy-ubuntu.mjs 의 isManagedEnvKey)와 같게 두고,
 * 최종 판단은 서버가 다시 한다.
 */
export const ANY_ENV_KEY = '*';

const ENV_KEY = /^[A-Z][A-Z0-9_]{0,127}$/;

// 배포 도구가 정하는 실행 위치·공개 주소, 그리고 프로세스 실행 환경을 바꿀 수 있는 키
const RESERVED_ENV_KEYS = new Set([
  'NODE_ENV',
  'PORT',
  'HOST',
  'INTERNAL_API_URL',
  'GADOC_PUBLIC_ORIGIN',
  'PATH',
  'HOME',
  'USER',
  'LOGNAME',
  'SHELL',
  'PWD',
  'OLDPWD',
  'TMPDIR',
  'TMP',
  'TEMP',
  'IFS',
  'PS4',
  'ENV',
  'BASH_ENV',
  'SHELLOPTS',
  'BASHOPTS',
  'HOSTNAME',
  'TERM',
  'TZ',
  'LANG',
  'DEBIAN_FRONTEND',
]);

const RESERVED_ENV_PREFIXES = [
  'NEXT_',
  'NODE_',
  'LD_',
  'DYLD_',
  'PM2_',
  'NPM_',
  'PNPM_',
  'COREPACK_',
  'MONGO_',
  'LC_',
  'SSH_',
  'GIT_',
  'SLACORD_',
];

export function acceptsAnyEnvKey(allowedKeys: readonly string[]): boolean {
  return allowedKeys.length === 1 && allowedKeys[0] === ANY_ENV_KEY;
}

export function isReservedEnvKey(key: string): boolean {
  return (
    RESERVED_ENV_KEYS.has(key) ||
    RESERVED_ENV_PREFIXES.some((prefix) => key.startsWith(prefix))
  );
}

export function isAllowedEnvCommandKey(
  allowedKeys: readonly string[],
  key: string,
): boolean {
  if (acceptsAnyEnvKey(allowedKeys))
    return ENV_KEY.test(key) && !isReservedEnvKey(key);
  return allowedKeys.includes(key);
}
