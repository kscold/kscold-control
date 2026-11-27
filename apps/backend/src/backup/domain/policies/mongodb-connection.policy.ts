export const MAX_MONGODB_URI_LENGTH = 2048;

/** 공백·따옴표·역슬래시가 섞이면 컨테이너 안 설정 파일이 깨지므로 허용하지 않는다. */
export const MONGODB_URI_PATTERN = /^mongodb(?:\+srv)?:\/\/[^\s"\\]+$/;

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

/** 덤프 컨테이너 안에서는 컨테이너 자신을 가리키게 되는 호스트 */
const LOOPBACK_HOST_PATTERN =
  /^(localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0|\[::1?\])(?::\d+)?$/i;

/** 같은 서버의 DB 에 접속할 때 호스트 자리에 쓰는 이름 */
export const SAME_HOST_ALIAS = 'host.docker.internal';

/**
 * URI 의 호스트 중에 localhost·127.0.0.1 같은 주소가 있는지 본다.
 *
 * 덤프는 별도 컨테이너에서 실행되므로 이런 주소는 이 서버가 아니라 그 컨테이너를 가리킨다.
 * 그대로 등록하면 예약 시각에 가서야 접속 실패로 드러나므로 등록할 때 알려준다.
 * 형식 검증(isValidMongodbUri)을 통과한 값에만 쓴다.
 */
export function usesLoopbackHost(uri: string): boolean {
  return splitMongodbUri(uri)
    .hosts.split(',')
    .some((host) => LOOPBACK_HOST_PATTERN.test(host.trim()));
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
