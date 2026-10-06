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

export const MAX_MONGODB_URI_LENGTH = 2048;

/** 디렉터리·컨테이너 이름에 그대로 쓰이므로 범위를 좁게 잡는다. */
export const BACKUP_TARGET_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;

/** 공백·따옴표·역슬래시가 섞이면 컨테이너 안 설정 파일이 깨지므로 허용하지 않는다. */
export const MONGODB_URI_PATTERN = /^mongodb(?:\+srv)?:\/\/[^\s"\\]+$/;

/** docker 인자로 들어가므로 옵션처럼 보이는 값(`-`로 시작)을 막는다. */
export const DUMP_IMAGE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/:@-]{0,199}$/;

export function isValidBackupTargetName(name: string): boolean {
  return BACKUP_TARGET_NAME_PATTERN.test(name);
}

export function isValidDumpImage(image: string): boolean {
  return DUMP_IMAGE_PATTERN.test(image);
}

export function isValidRetentionDays(value: number): boolean {
  return (
    Number.isInteger(value) && value >= 1 && value <= MAX_BACKUP_RETENTION_DAYS
  );
}

/** URI 를 스킴·자격증명·호스트·나머지(경로와 옵션)로 나눈다. */
function splitMongodbUri(uri: string) {
  const schemeEnd = uri.indexOf('://') + 3;
  const rest = uri.slice(schemeEnd);
  const authorityEnd = rest.search(/[/?]/);
  const authority = authorityEnd === -1 ? rest : rest.slice(0, authorityEnd);
  const tail = authorityEnd === -1 ? '' : rest.slice(authorityEnd);
  const separator = authority.lastIndexOf('@');

  return {
    scheme: uri.slice(0, schemeEnd),
    hasCredentials: separator >= 0,
    hosts: authority.slice(separator + 1),
    authority,
    tail,
  };
}

/**
 * MongoDB 접속 URI 형식을 확인한다.
 *
 * 자격증명 구분자(@)는 호스트 앞에 한 번만 올 수 있다. 비밀번호에 `@` 나 `/` 를
 * 인코딩하지 않고 넣으면 어디까지가 자격증명인지 알 수 없어, 화면에 보여주는
 * 접속 위치에 비밀번호 일부가 섞여 나갈 수 있으므로 저장 전에 거절한다.
 */
export function isValidMongodbUri(uri: string): boolean {
  if (uri.length > MAX_MONGODB_URI_LENGTH || !MONGODB_URI_PATTERN.test(uri)) {
    return false;
  }

  const { authority, hosts, tail } = splitMongodbUri(uri);
  const separatorCount = authority.split('@').length - 1;

  return separatorCount <= 1 && !tail.includes('@') && hosts.length > 0;
}

/**
 * 접속 URI 에서 자격증명과 옵션을 뺀 표시용 문자열을 만든다.
 * 형식 검증(isValidMongodbUri)을 통과한 값에만 쓴다.
 */
export function summarizeMongodbUri(uri: string): string {
  const { scheme, hosts, tail } = splitMongodbUri(uri);
  const queryStart = tail.indexOf('?');
  const databasePath = queryStart === -1 ? tail : tail.slice(0, queryStart);

  return `${scheme}${hosts}${databasePath === '/' ? '' : databasePath}`.slice(
    0,
    255,
  );
}

/** 암호문을 대상에 묶어 두는 값. 다른 대상의 암호문을 옮겨 붙이면 복호화가 실패한다. */
export function backupTargetAssociatedData(targetName: string): string {
  return `backup-target:${targetName}`;
}
