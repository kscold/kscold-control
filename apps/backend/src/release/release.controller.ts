import { Controller, Get } from '@nestjs/common';
import { createHash } from 'crypto';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join, relative } from 'path';
import { resolveFrontendDistPath } from '../common/utils/frontend-dist-path.util';

interface ReleaseManifest {
  schemaVersion: number;
  version: string;
  revision: string;
  branch: string;
  builtAt: string;
  dirty: boolean;
  artifacts: Record<string, string>;
}

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
    const manifestPath = join(__dirname, '..', 'release-manifest.json');
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
      const root = join(__dirname, '..', '..', '..', '..');
      const frontendDist = resolveFrontendDistPath();
      const actualPaths = [
        ...this.listFiles(join(root, 'apps', 'backend', 'dist')).map(
          (filePath) => relative(root, filePath),
        ),
        ...this.listFiles(frontendDist).map((filePath) =>
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

  private listFiles(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const target = join(directory, entry.name);
      return entry.isDirectory() ? this.listFiles(target) : [target];
    });
  }
}
