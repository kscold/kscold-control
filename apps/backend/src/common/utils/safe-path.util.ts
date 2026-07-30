import * as path from 'node:path';

/**
 * target 이 root 와 같거나 root 하위 경로인지 판별한다.
 *
 * 경로 탈출(../, 절대 경로) 방어의 "정규화 + 루트 포함" 부분만 담당하는 순수
 * 판별 함수다. 예외를 던지지 않으므로 호출자가 각자의 예외 타입(BadRequest /
 * Forbidden / Error)과 메시지로 감쌀 수 있다.
 *
 * 주의: 문자열 수준의 검사이므로 심볼릭 링크는 보지 않는다. 링크까지 막아야
 * 하는 호출자는 fs.realpath 로 실제 경로를 구한 뒤 이 함수를 다시 적용해야
 * 한다(terminal 의 WorkspaceGitService 참고).
 */
export function isPathInsideRoot(root: string, target: string): boolean {
  const relativeToRoot = path.relative(
    path.resolve(root),
    path.resolve(target),
  );

  return (
    relativeToRoot === '' ||
    (relativeToRoot !== '..' &&
      !relativeToRoot.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relativeToRoot))
  );
}
