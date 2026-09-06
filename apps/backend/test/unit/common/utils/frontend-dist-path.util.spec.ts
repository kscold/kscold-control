import { join, resolve } from 'path';
import { resolveFrontendDistPath } from '@/common/utils/frontend-dist-path.util';

describe('resolveFrontendDistPath', () => {
  it('설정된 절대 운영 경로를 그대로 사용한다', () => {
    expect(resolveFrontendDistPath('/srv/control/frontend-current')).toBe(
      '/srv/control/frontend-current',
    );
  });

  it('상대 경로는 프로세스 작업 디렉터리 기준으로 고정한다', () => {
    expect(resolveFrontendDistPath('runtime/frontend-current')).toBe(
      resolve(process.cwd(), 'runtime/frontend-current'),
    );
  });

  it('설정이 없으면 워크스페이스 프론트엔드 dist를 사용한다', () => {
    expect(resolveFrontendDistPath('')).toBe(
      join(process.cwd(), '..', 'frontend', 'dist'),
    );
  });
});
