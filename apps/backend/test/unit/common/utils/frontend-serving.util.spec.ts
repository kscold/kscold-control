import { type INestApplication } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { NestFactory } from '@nestjs/core';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { frontendServingOptions } from '@/common/utils/frontend-serving.util';

describe('프론트엔드 정적 파일과 SPA 응답 분리', () => {
  let app: INestApplication;
  let directory: string;
  let origin: string;
  const html = '<div id="root"></div>';

  beforeAll(async () => {
    directory = mkdtempSync(join(tmpdir(), 'control-static-'));
    mkdirSync(join(directory, 'assets'));
    writeFileSync(join(directory, 'index.html'), html);
    writeFileSync(
      join(directory, 'assets/workspace-abcdefgh.js'),
      'export const ready = true;',
    );
    class StaticTestModule {}
    app = await NestFactory.create(
      {
        module: StaticTestModule,
        imports: [ServeStaticModule.forRoot(frontendServingOptions(directory))],
      },
      { logger: false },
    );
    await app.listen(0, '127.0.0.1');
    origin = await app.getUrl();
  });

  afterAll(async () => {
    await app?.close();
    if (directory) rmSync(directory, { recursive: true, force: true });
  });

  it.each(['/', '/index.html', '/terminal', '/keys'])(
    '%s HTML은 저장하지 않는다',
    async (route) => {
      const response = await fetch(origin + route);
      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(await response.text()).toBe(html);
    },
  );

  it('존재하는 해시 번들은 JavaScript로 캐시할 수 있다', async () => {
    const response = await fetch(origin + '/assets/workspace-abcdefgh.js');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('javascript');
    expect(response.headers.get('cache-control')).toContain('immutable');
    expect(await response.text()).toContain('export const ready');
  });

  it.each([
    '/assets/missing.js',
    '/assets/missing.css',
    '/api/missing',
    '/api',
  ])('%s 누락을 HTML 성공으로 숨기지 않는다', async (route) => {
    const response = await fetch(origin + route);
    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).not.toContain('text/html');
    expect(await response.text()).not.toContain(html);
  });
});
