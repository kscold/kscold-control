import { Controller, Get } from '@nestjs/common';
import { createHash } from 'crypto';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join, relative } from 'path';
import { resolveFrontendDistPath } from '../../../common/utils/frontend-dist-path.util';

// scripts/lib/frontend-release.mjs 가 남기는 이번 빌드 원본 자산 목록
const FRONTEND_ASSET_LIST = '.control-frontend-assets.json';

interface ReleaseManifest {
  schemaVersion: number;
  version: string;
  revision: string;
  branch: string;
  builtAt: string;
  dirty: boolean;
  artifacts: Record<string, string>;
}


// 빌드 결과 dist/release/presentation/controllers 에서 dist 로 올라간다. 파일을 옮기면 이 깊이도 맞춘다.
const DIST_ROOT = join(__dirname, '..', '..', '..');
@Controller('health')
export class ReleaseController {
  private readonly startedAt = Date.now();
  private readonly release = this.readRelease();

  @Get()
  getHealth() {
    return {
      status:
        this.release.integrity === 'verified' && !this.release.dirty
          ? 'ok'
          : 'degraded',
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      release: this.release,
    };
  }

  private readRelease() {
    const manifestPath = join(DIST_ROOT, 'release-manifest.json');
    if (!existsSync(manifestPath)) {
      return {
        version: 'development',
        revision: 'development',
        builtAt: null,
        branch: null,
        dirty: true,
        integrity: 'unavailable',
      };
    }

    try {
      const manifest = JSON.parse(
        readFileSync(manifestPath, 'utf8'),
      ) as ReleaseManifest;
      const root = join(DIST_ROOT, '..', '..', '..');
      const frontendDist = resolveFrontendDistPath();
      const actualPaths = [
        ...this.listFiles(join(root, 'apps', 'backend', 'dist')).map(
          (filePath) => relative(root, filePath),
        ),
        ...this.listOwnFrontendFiles(frontendDist).map((filePath) =>
          join('apps', 'frontend', 'dist', relative(frontendDist, filePath)),
        ),
      ]
        .map((filePath) => filePath.replaceAll('\\', '/'))
        .filter(
          (relativePath) =>
            relativePath !== 'apps/backend/dist/release-manifest.json',
        )
        .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
      const manifestPaths = Object.keys(manifest.artifacts ?? {}).sort(
        (left, right) => (left < right ? -1 : left > right ? 1 : 0),
      );
      const sameFileSet =
        actualPaths.length > 0 &&
        actualPaths.length === manifestPaths.length &&
        actualPaths.every(
          (relativePath, index) => relativePath === manifestPaths[index],
        );
      const integrity =
        manifest.schemaVersion === 2 &&
        /^\d+\.\d+\.\d+$/.test(manifest.version) &&
        !manifest.dirty &&
        sameFileSet &&
        Object.entries(manifest.artifacts).every(([relativePath, expected]) => {
          const frontendPrefix = 'apps/frontend/dist/';
          const artifact = relativePath.startsWith(frontendPrefix)
            ? join(frontendDist, relativePath.slice(frontendPrefix.length))
            : join(root, relativePath);
          if (!/^[a-f0-9]{64}$/.test(expected) || !existsSync(artifact)) {
            return false;
          }
          return (
            createHash('sha256')
              .update(readFileSync(artifact))
              .digest('hex') === expected
          );
        });
      return {
        version: manifest.version,
        revision: manifest.revision,
        builtAt: manifest.builtAt,
        branch: manifest.branch,
        dirty: manifest.dirty,
        integrity: integrity ? 'verified' : 'mismatch',
      };
    } catch {
      return {
        version: 'unknown',
        revision: 'unknown',
        builtAt: null,
        branch: null,
        dirty: true,
        integrity: 'invalid',
      };
    }
  }

  // 배포 때 옛 화면이 쓰던 자산을 함께 남겨 두므로, 이번 빌드 원본 목록에 있는 자산만 검사한다.
  private listOwnFrontendFiles(directory: string): string[] {
    const ownListPath = join(directory, FRONTEND_ASSET_LIST);
    if (!existsSync(ownListPath)) return this.listFiles(directory);
    const own = new Set(
      JSON.parse(readFileSync(ownListPath, 'utf8')) as string[],
    );
    const assets = join(directory, 'assets');
    return this.listFiles(directory).filter((filePath) => {
      if (filePath === ownListPath) return false;
      const fromAssets = relative(assets, filePath);
      const inAssets = !fromAssets.startsWith('..') && !fromAssets.includes('/');
      // 원본 목록에는 소스맵(.map)이 없으므로 짝이 되는 자산 이름으로 판단한다.
      return !inAssets || own.has(fromAssets.replace(/\.map$/, ''));
    });
  }

  private listFiles(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const target = join(directory, entry.name);
      return entry.isDirectory() ? this.listFiles(target) : [target];
    });
  }
}
