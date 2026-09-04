import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const backendRoot = path.join(repoRoot, 'apps/backend/src');
const platformEnvironmentKeys = new Set(['HOME', 'PATH', 'USER']);
const violations = [];

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory()
      ? sourceFiles(entryPath)
      : entry.name.endsWith('.ts')
        ? [entryPath]
        : [];
  });
}

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function valuesFromConstObject(relativePath) {
  const values = new Set();
  for (const match of read(relativePath).matchAll(
    /^\s*[A-Z][A-Z0-9_]*:\s*'([^']+)'/gm,
  )) {
    values.add(match[1]);
  }
  return values;
}

function compareConstObjects(label, backendPath, frontendPath) {
  const backend = valuesFromConstObject(backendPath);
  const frontend = valuesFromConstObject(frontendPath);
  const missingFrontend = [...backend].filter((value) => !frontend.has(value));
  const missingBackend = [...frontend].filter((value) => !backend.has(value));

  if (missingFrontend.length || missingBackend.length) {
    violations.push(
      `${label} 불일치: frontend 누락 [${missingFrontend.join(', ')}], backend 누락 [${missingBackend.join(', ')}]`,
    );
  }
}

function discoverRuntimeEnvironmentKeys() {
  const keys = new Set();
  for (const filePath of sourceFiles(backendRoot)) {
    const contents = fs.readFileSync(filePath, 'utf8');
    for (const match of contents.matchAll(/process\.env\.([A-Z0-9_]+)/g)) {
      keys.add(match[1]);
    }
    for (const match of contents.matchAll(
      /config(?:Service)?\.get(?:<[^>]+>)?\(['"]([A-Z0-9_]+)['"]\)/g,
    )) {
      keys.add(match[1]);
    }
  }
  return keys;
}

function documentedEnvironmentKeys() {
  const keys = new Set();
  for (const line of read('.env.example').split(/\r?\n/)) {
    const match = line.match(/^\s*#?\s*([A-Z][A-Z0-9_]*)=/);
    if (match) keys.add(match[1]);
  }
  return keys;
}

function loadEcosystemApplication(runtimeKeys) {
  for (const key of runtimeKeys) {
    process.env[key] = `contract-${key.toLowerCase()}`;
  }
  process.env.DATABASE_URL =
    'postgresql://contract:contract@localhost/contract';
  process.env.JWT_SECRET = 'contract-jwt-secret-at-least-32-characters';

  const require = createRequire(import.meta.url);
  const ecosystem = require(path.join(repoRoot, 'ecosystem.config.js'));
  return ecosystem.apps?.find((app) => app.name === 'kscold-control');
}

compareConstObjects(
  '권한 상수',
  'apps/backend/src/common/constants/permissions.ts',
  'apps/frontend/src/shared/config/permissions.ts',
);
compareConstObjects(
  '역할 상수',
  'apps/backend/src/common/constants/roles.ts',
  'apps/frontend/src/shared/config/roles.ts',
);

const runtimeKeys = discoverRuntimeEnvironmentKeys();
const documentedKeys = documentedEnvironmentKeys();
const undocumented = [...runtimeKeys].filter(
  (key) => !platformEnvironmentKeys.has(key) && !documentedKeys.has(key),
);
if (undocumented.length) {
  violations.push(`.env.example 누락: ${undocumented.sort().join(', ')}`);
}

const ecosystemApplication = loadEcosystemApplication(runtimeKeys);
const ecosystemEnvironment = ecosystemApplication?.env ?? {};
const notForwarded = [...runtimeKeys].filter(
  (key) =>
    !platformEnvironmentKeys.has(key) &&
    !Object.prototype.hasOwnProperty.call(ecosystemEnvironment, key),
);
if (notForwarded.length) {
  violations.push(`PM2 환경 전달 누락: ${notForwarded.sort().join(', ')}`);
}
if (
  ecosystemApplication?.instances !== 1 ||
  ecosystemApplication?.exec_mode !== 'fork'
) {
  violations.push(
    'PM2는 프로젝트별 파일 잠금이 단일 프로세스인 동안 instances=1, exec_mode=fork를 유지해야 함',
  );
}

if (violations.length) {
  console.error('Runtime contract violations found:');
  violations.forEach((violation) => console.error(`- ${violation}`));
  process.exitCode = 1;
} else {
  console.log(
    `Runtime contracts passed (${runtimeKeys.size} env keys, permissions/roles synchronized).`,
  );
}
