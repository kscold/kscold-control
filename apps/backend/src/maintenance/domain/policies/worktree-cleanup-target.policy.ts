/**
 * 작업 폴더 정리 대상 입력 규칙
 *
 * 정리 루트 아래 폴더는 실제로 삭제되므로, 루트는 홈 디렉터리 아래의 절대 경로로만 받는다.
 */

/** 대상 이름. 백업 디렉터리 이름으로도 쓰인다. */
export const CLEANUP_TARGET_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;

/** 기준 브랜치 이름 (예: origin/dev). 옵션처럼 보이는 값(-로 시작)은 막는다. */
export const BASE_REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$/;

export const DEFAULT_BASE_REFS = ['origin/dev', 'origin/main', 'origin/master'];

export const MAX_BASE_REFS = 10;

export const MAX_ROOT_PATH_LENGTH = 1024;

export function isValidCleanupTargetName(name: string): boolean {
  return CLEANUP_TARGET_NAME_PATTERN.test(name);
}

export function isValidBaseRef(ref: string): boolean {
  return BASE_REF_PATTERN.test(ref) && !ref.includes('..');
}

/**
 * 정리 루트로 쓸 수 있는 경로인지 본다 (실제 존재 여부는 인프라가 확인한다).
 * 홈 디렉터리 자체나 그 바깥, 상대 경로, `..` 이 섞인 경로는 받지 않는다.
 */
export function isAllowedCleanupRoot(
  rootPath: string,
  homeDirectory: string,
): boolean {
  if (rootPath.length > MAX_ROOT_PATH_LENGTH || !rootPath.startsWith('/')) {
    return false;
  }
  const segments = rootPath.split('/');
  if (segments.some((segment) => segment === '..' || segment === '.')) {
    return false;
  }
  const normalizedHome = homeDirectory.replace(/\/+$/, '');
  const normalizedRoot = rootPath.replace(/\/+$/, '');
  return normalizedRoot.startsWith(`${normalizedHome}/`);
}
