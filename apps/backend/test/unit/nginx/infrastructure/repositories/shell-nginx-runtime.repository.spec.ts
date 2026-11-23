import { describe, expect, it } from 'vitest';
import {
  ShellNginxRuntimeRepository,
  resolveNginxContainer,
} from '@/nginx/infrastructure/repositories/shell-nginx-runtime.repository';

describe('resolveNginxContainer', () => {
  it('설정이 없으면 지금처럼 kscold-nginx 를 쓴다', () => {
    expect(resolveNginxContainer({})).toBe('kscold-nginx');
  });

  it('이름을 주면 그 컨테이너를 쓴다', () => {
    expect(resolveNginxContainer({ NGINX_CONTAINER: 'edge-proxy' })).toBe(
      'edge-proxy',
    );
  });

  it('빈 값이면 nginx 연동을 끈다', () => {
    expect(resolveNginxContainer({ NGINX_CONTAINER: ' ' })).toBeNull();
  });
});

describe('nginx 연동이 꺼졌을 때', () => {
  it('설정 검사와 재적용을 실행하지 않고 꺼져 있다고 돌려준다', async () => {
    const previous = process.env.NGINX_CONTAINER;
    process.env.NGINX_CONTAINER = '';
    try {
      const repository = new ShellNginxRuntimeRepository();
      expect(await repository.reload()).toEqual({
        success: false,
        output: expect.stringContaining('nginx 연동이 꺼져 있습니다'),
      });
      expect((await repository.testConfig()).success).toBe(false);
    } finally {
      if (previous === undefined) delete process.env.NGINX_CONTAINER;
      else process.env.NGINX_CONTAINER = previous;
    }
  });
});
