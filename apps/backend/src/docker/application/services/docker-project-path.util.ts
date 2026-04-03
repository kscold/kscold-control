import * as fs from 'fs';
import * as path from 'path';

export function resolveDockerProjectRoot(startDir: string): string {
  let currentDir = startDir;

  while (true) {
    if (fs.existsSync(path.join(currentDir, 'docker-compose.yml'))) {
      return currentDir;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      return process.cwd();
    }

    currentDir = parentDir;
  }
}
