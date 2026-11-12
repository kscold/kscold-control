import type { ServeStaticModuleOptions } from '@nestjs/serve-static';
import { basename } from 'node:path';
import { resolveFrontendDistPath } from './frontend-dist-path.util';

export function frontendServingOptions(
  rootPath = resolveFrontendDistPath(),
): ServeStaticModuleOptions {
  return {
    rootPath,
    // 사라진 번들에 index.html을 반환하면 Safari의 동적 import가 실패한다.
    exclude: ['/api', '/api/{*any}', '/assets', '/assets/{*any}'],
    serveStaticOptions: {
      setHeaders(response, file) {
        if (basename(file) === 'index.html') {
          response.setHeader('Cache-Control', 'no-store');
        } else if (
          /[\\/]assets[\\/]/.test(file) &&
          /-[A-Za-z0-9_-]{8,}\.[a-z0-9]+$/.test(file)
        ) {
          response.setHeader(
            'Cache-Control',
            'public, max-age=31536000, immutable',
          );
        }
      },
    },
  };
}
