import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const violations = [];

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(entryPath);
    }
    return /\.(ts|tsx)$/.test(entry.name) ? [entryPath] : [];
  });
}

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function relativeToRoot(filePath) {
  return path.relative(repoRoot, filePath).replaceAll(path.sep, '/');
}

function report(rule, filePath, detail) {
  violations.push(
    `${rule}: ${relativeToRoot(filePath)}${detail ? ` (${detail})` : ''}`,
  );
}

function checkFrontendBoundaries() {
  const root = path.join(repoRoot, 'apps/frontend/src');
  const layerOrder = ['shared', 'entities', 'features', 'pages', 'app'];
  const layerRank = new Map(layerOrder.map((layer, index) => [layer, index]));

  for (const filePath of sourceFiles(root)) {
    const relativePath = path
      .relative(root, filePath)
      .replaceAll(path.sep, '/');
    const sourceLayer = relativePath.split('/')[0];
    const contents = read(filePath);

    if (
      relativePath.startsWith('features/') &&
      relativePath.includes('/model/')
    ) {
      if (/from\s+['"]@\/shared\/api\/client['"]/.test(contents)) {
        report('frontend model must use feature API', filePath);
      }
    }

    if (!layerRank.has(sourceLayer)) {
      continue;
    }

    for (const match of contents.matchAll(/from\s+['"]@\/([^/'"]+)/g)) {
      const targetLayer = match[1];
      if (
        layerRank.has(targetLayer) &&
        layerRank.get(targetLayer) > layerRank.get(sourceLayer)
      ) {
        report(
          'frontend FSD upward import',
          filePath,
          `${sourceLayer} -> ${targetLayer}`,
        );
      }
    }
  }
}

function checkBackendBoundaries() {
  const root = path.join(repoRoot, 'apps/backend/src');

  for (const filePath of sourceFiles(root)) {
    const relativePath = path
      .relative(root, filePath)
      .replaceAll(path.sep, '/');
    const [, layer] = relativePath.split('/');
    const contents = read(filePath);

    if (
      layer === 'application' &&
      /from\s+['"][^'"]*presentation\//.test(contents)
    ) {
      report('backend application imports presentation', filePath);
    }

    if (
      layer === 'domain' &&
      /from\s+['"][^'"]*\/(?:application|infrastructure|presentation)\//.test(
        contents,
      )
    ) {
      report('backend domain imports outer layer', filePath);
    }
  }
}

function checkDtoPlacement() {
  const root = path.join(repoRoot, 'apps/backend/src');

  for (const filePath of sourceFiles(root)) {
    const relativePath = path
      .relative(root, filePath)
      .replaceAll(path.sep, '/');

    if (relativePath.includes('/dto/')) {
      continue;
    }

    for (const match of read(filePath).matchAll(
      /^(?:export\s+)?(?:interface|class|type)\s+([A-Za-z0-9_]*Dto)\b/gm,
    )) {
      report(
        'backend DTO declaration must be in dto folder',
        filePath,
        match[1],
      );
    }
  }
}

function checkDockerBoundaries() {
  const dockerRoot = path.join(repoRoot, 'apps/backend/src/docker');
  const applicationRoot = path.join(dockerRoot, 'application');
  const presentationRoot = path.join(dockerRoot, 'presentation');
  const repositoryRoot = path.join(dockerRoot, 'domain/repositories');

  for (const filePath of sourceFiles(applicationRoot)) {
    const contents = read(filePath);

    if (
      /(?:from\s+|require\()['"](?:node:)?(?:fs|path|child_process|util)(?:\/[^'"]*)?['"]/.test(
        contents,
      )
    ) {
      report('docker application imports host runtime', filePath);
    }

    if (/from\s+['"][^'"]*infrastructure\//.test(contents)) {
      report('docker application imports infrastructure', filePath);
    }
  }

  for (const filePath of sourceFiles(presentationRoot)) {
    if (/from\s+['"][^'"]*domain\/gateways\//.test(read(filePath))) {
      report('docker presentation imports gateway', filePath);
    }
  }

  for (const filePath of sourceFiles(repositoryRoot)) {
    if (!filePath.endsWith('.repository.interface.ts')) {
      report('docker repository folder contains non-repository port', filePath);
    }
  }
}

function checkBackendTestLayout() {
  const sourceRoot = path.join(repoRoot, 'apps/backend/src');
  const testRoot = path.join(repoRoot, 'apps/backend/test/unit');

  for (const filePath of sourceFiles(sourceRoot)) {
    if (/\.(spec|test)\.ts$/.test(filePath)) {
      report('backend unit test must be outside source tree', filePath);
    }
  }

  if (!fs.existsSync(testRoot)) {
    report('backend unit test root missing', testRoot);
  }
}

checkFrontendBoundaries();
checkBackendBoundaries();
checkDtoPlacement();
checkDockerBoundaries();
checkBackendTestLayout();

if (violations.length > 0) {
  console.error('Architecture boundary violations found:');
  violations.forEach((violation) => console.error(`- ${violation}`));
  process.exitCode = 1;
} else {
  console.log('Architecture boundary check passed.');
}
