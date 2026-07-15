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

checkFrontendBoundaries();
checkBackendBoundaries();

if (violations.length > 0) {
  console.error('Architecture boundary violations found:');
  violations.forEach((violation) => console.error(`- ${violation}`));
  process.exitCode = 1;
} else {
  console.log('Architecture boundary check passed.');
}
