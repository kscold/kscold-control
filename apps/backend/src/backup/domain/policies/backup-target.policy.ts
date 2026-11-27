/**
 * 백업 대상 입력 규칙
 *
 * 대상 이름은 디렉터리·컨테이너 이름에, 이미지는 docker 인자에, URI 는 컨테이너 안
 * 설정 파일에 그대로 들어간다. 그래서 형식을 좁게 잡아 저장 전에 걸러낸다.
 */

/** 보관 기간을 지정하지 않은 대상에 적용하는 기본 보관 일수 */
export const DEFAULT_BACKUP_RETENTION_DAYS = 10;

export const MAX_BACKUP_RETENTION_DAYS = 3650;

/** 이미지를 지정하지 않은 대상에 쓰는 mongodump 실행 이미지 */
export const DEFAULT_MONGODB_DUMP_IMAGE = 'mongo:7';

export const MAX_BACKUP_DESCRIPTION_LENGTH = 500;

/** 디렉터리·컨테이너 이름에 그대로 쓰이므로 범위를 좁게 잡는다. */
export const BACKUP_TARGET_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;

/** docker 인자로 들어가므로 옵션처럼 보이는 값(`-`로 시작)을 막는다. */
export const DUMP_IMAGE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/:@-]{0,199}$/;

/** docker 인자로 들어가므로 컨테이너 이름 형식만 허용한다. 빈 값은 "지정 안 함"이다. */
export const NETWORK_CONTAINER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;

export function isValidBackupTargetName(name: string): boolean {
  return BACKUP_TARGET_NAME_PATTERN.test(name);
}

export function isValidNetworkContainer(name: string): boolean {
  return NETWORK_CONTAINER_PATTERN.test(name);
}

export function isValidDumpImage(image: string): boolean {
  return DUMP_IMAGE_PATTERN.test(image);
}

export function isValidRetentionDays(value: number): boolean {
  return (
    Number.isInteger(value) && value >= 1 && value <= MAX_BACKUP_RETENTION_DAYS
  );
}

/** 암호문을 대상에 묶어 두는 값. 다른 대상의 암호문을 옮겨 붙이면 복호화가 실패한다. */
export function backupTargetAssociatedData(targetName: string): string {
  return `backup-target:${targetName}`;
}
