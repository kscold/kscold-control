import * as path from 'node:path';
import { isPathInsideRoot } from '@/common/utils/safe-path.util';

/**
 * 경로 탈출 방어의 핵심 판별부라 통합 전 4개 구현과 결과가 같아야 한다.
 * 통합 전 두 가지 구현을 그대로 옮겨 두고 동일 판정인지 대조한다.
 */
const legacyStartsWith = (root: string, target: string): boolean => {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  return (
    resolvedTarget === resolvedRoot ||
    resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`)
  );
};

const legacyRelative = (root: string, target: string): boolean => {
  const relativeToRoot = path.relative(root, path.resolve(root, target));
  return !(
    relativeToRoot === '..' ||
    relativeToRoot.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativeToRoot)
  );
};

describe('isPathInsideRoot', () => {
  const root = '/srv/repository-storage/demo';

  it('루트 하위 경로는 허용한다', () => {
    expect(isPathInsideRoot(root, `${root}/src/index.ts`)).toBe(true);
  });

  it('루트 자기 자신은 허용한다', () => {
    expect(isPathInsideRoot(root, root)).toBe(true);
    expect(isPathInsideRoot(root, `${root}/`)).toBe(true);
  });

  it('중간에 ..가 있어도 최종 위치가 루트 안이면 허용한다', () => {
    expect(isPathInsideRoot(root, `${root}/a/../b/c.txt`)).toBe(true);
  });

  it('..로 루트를 벗어나면 차단한다', () => {
    expect(isPathInsideRoot(root, `${root}/../secret.txt`)).toBe(false);
    expect(isPathInsideRoot(root, `${root}/a/../../../etc/passwd`)).toBe(false);
  });

  it('루트 밖 절대 경로는 차단한다', () => {
    expect(isPathInsideRoot(root, '/etc/passwd')).toBe(false);
  });

  it('루트 상위 디렉토리는 차단한다', () => {
    expect(isPathInsideRoot(root, path.dirname(root))).toBe(false);
  });

  it('이름이 루트로 시작만 하는 형제 경로는 차단한다', () => {
    expect(isPathInsideRoot('/srv/app', '/srv/app-backup/x')).toBe(false);
  });

  it('통합 전 두 구현과 판정이 같다', () => {
    const cases: Array<[string, string]> = [
      [root, `${root}/src/index.ts`],
      [root, root],
      [root, `${root}/a/../b/c.txt`],
      [root, `${root}/../secret.txt`],
      [root, '/etc/passwd'],
      [root, path.dirname(root)],
      ['/srv/app', '/srv/app-backup/x'],
      ['/Users/kscold', '/Users/kscold/Desktop/kscold-control'],
      ['/Users/kscold', '/Users/kscold2/Desktop'],
    ];

    for (const [caseRoot, caseTarget] of cases) {
      const actual = isPathInsideRoot(caseRoot, caseTarget);
      expect([caseRoot, caseTarget, actual]).toEqual([
        caseRoot,
        caseTarget,
        legacyStartsWith(caseRoot, caseTarget),
      ]);
      expect([caseRoot, caseTarget, actual]).toEqual([
        caseRoot,
        caseTarget,
        legacyRelative(caseRoot, caseTarget),
      ]);
    }
  });
});
