import {
  isAllowedCleanupRoot,
  isValidBaseRef,
  isValidCleanupTargetName,
} from '@/maintenance/domain/policies/worktree-cleanup-target.policy';

describe('작업 폴더 정리 대상 입력 규칙', () => {
  const home = '/home/example';

  it.each([
    '/home/example/Desktop/projectbeta-review/.worktrees',
    '/home/example/work/',
  ])('홈 아래 절대 경로 %s 는 허용한다', (root) => {
    expect(isAllowedCleanupRoot(root, home)).toBe(true);
  });

  it.each([
    '/home/example',
    '/home/example/',
    '/Users/other/worktrees',
    '/',
    'Desktop/worktrees',
    '/home/example/Desktop/../../etc',
    '/home/example/./x',
    '/home/examplex/worktrees',
  ])('%s 는 거부한다', (root) => {
    expect(isAllowedCleanupRoot(root, home)).toBe(false);
  });

  it.each(['origin/dev', 'origin/main', 'upstream/release-1.2'])(
    '기준 브랜치 %s 는 허용한다',
    (ref) => {
      expect(isValidBaseRef(ref)).toBe(true);
    },
  );

  it.each(['--all', 'origin/../x', 'a b', ''])(
    '기준 브랜치 %p 는 거부한다',
    (ref) => {
      expect(isValidBaseRef(ref)).toBe(false);
    },
  );

  it('대상 이름 형식을 확인한다', () => {
    expect(isValidCleanupTargetName('projectbeta-review')).toBe(true);
    expect(isValidCleanupTargetName('../x')).toBe(false);
  });
});
