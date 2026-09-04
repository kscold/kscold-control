import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { promises as fsp } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Client } from 'pg';
import jwt from 'jsonwebtoken';
import { chromium } from '@playwright/test';

const baseUrl =
  process.env.CONTROL_LIVE_BASE_URL || 'https://control.kscold.com';
const screenshotPath =
  process.env.CONTROL_LIVE_SMOKE_SCREENSHOT ||
  path.resolve(process.cwd(), 'test-results', 'repository-live-smoke.png');

function readLocalEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  const content = fs.readFileSync(envPath, 'utf8');

  return content.split('\n').reduce((acc, rawLine) => {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      return acc;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) {
      return acc;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    acc[key] = value;
    return acc;
  }, {});
}

function withDatabaseName(connectionString, databaseName) {
  const url = new URL(connectionString);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

function buildConnectionCandidates(env) {
  const candidates = [
    process.env.CONTROL_E2E_DATABASE_URL,
    env.DATABASE_URL,
    env.DATABASE_URL
      ? withDatabaseName(env.DATABASE_URL, 'kscold-infra-db')
      : undefined,
    env.DATABASE_URL
      ? withDatabaseName(env.DATABASE_URL, 'control-db')
      : undefined,
    env.INFRA_DB_USER && env.INFRA_DB_PASSWORD
      ? `postgresql://${env.INFRA_DB_USER}:${env.INFRA_DB_PASSWORD}@localhost:5432/kscold-infra-db`
      : undefined,
    env.INFRA_DB_USER && env.INFRA_DB_PASSWORD
      ? `postgresql://${env.INFRA_DB_USER}:${env.INFRA_DB_PASSWORD}@localhost:5432/control-db`
      : undefined,
  ];

  return [...new Set(candidates.filter(Boolean))];
}

async function findAdminUser(connectionString) {
  const client = new Client({ connectionString });

  try {
    await client.connect();
    const result = await client.query(`
      SELECT
        u.id,
        u.email,
        array_remove(array_agg(DISTINCT r.name), NULL) AS roles,
        array_remove(array_agg(DISTINCT p.name), NULL) AS permissions,
        bool_or(r.name IN ('admin', 'super_admin')) AS is_admin
      FROM users u
      LEFT JOIN user_roles ur ON ur."userId" = u.id
      LEFT JOIN roles r ON r.id = ur."roleId"
      LEFT JOIN role_permissions rp ON rp."roleId" = r.id
      LEFT JOIN permissions p ON p.id = rp."permissionId"
      GROUP BY u.id, u.email
      ORDER BY is_admin DESC, u.email ASC
      LIMIT 5
    `);

    const row = result.rows.find((item) => item.is_admin) ?? result.rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      email: row.email,
      roles: row.roles ?? [],
      permissions: row.permissions ?? [],
    };
  } finally {
    await client.end();
  }
}

async function validateToken(token) {
  const response = await fetch(`${baseUrl}/api/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return response.ok;
}

async function createPersistedAdminAuthState() {
  const env = readLocalEnv();
  const jwtSecret = process.env.JWT_SECRET ?? env.JWT_SECRET;

  if (!jwtSecret) {
    throw new Error('JWT_SECRET을 찾지 못했습니다.');
  }

  for (const connectionString of buildConnectionCandidates(env)) {
    try {
      const user = await findAdminUser(connectionString);
      if (!user) {
        continue;
      }

      const token = jwt.sign(
        {
          sub: user.id,
          email: user.email,
        },
        jwtSecret,
        { expiresIn: '15m' },
      );

      const isValid = await validateToken(token);
      if (!isValid) {
        continue;
      }

      const persistedState = JSON.stringify({
        state: {
          token,
          user,
        },
        version: 0,
      });

      return { persistedState, token, user };
    } catch {
      continue;
    }
  }

  throw new Error('운영 스모크용 관리자 인증 정보를 만들지 못했습니다.');
}

async function apiRequest(apiPath, token, init = {}) {
  const response = await fetch(`${baseUrl}/api${apiPath}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `${init.method || 'GET'} ${apiPath} failed: ${response.status} ${detail}`,
    );
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function apiMultipartRequest(apiPath, token, files) {
  const formData = new FormData();
  const relativePaths = [];

  for (const file of files) {
    formData.append(
      'files',
      new Blob([file.content]),
      path.posix.basename(file.relativePath),
    );
    relativePaths.push(file.relativePath);
  }
  formData.append('relativePaths', JSON.stringify(relativePaths));

  const response = await fetch(`${baseUrl}/api${apiPath}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!response.ok) {
    const detail = await response.text();
    let payload = null;
    try {
      payload = JSON.parse(detail);
    } catch {
      payload = null;
    }
    const error = new Error(
      `POST ${apiPath} failed: ${response.status} ${detail}`,
    );
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return response.json();
}

async function waitForCompletedUploadSession(
  projectId,
  token,
  previousSessionId,
  timeoutMs = 120_000,
) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const latest = await apiRequest(
      `/repository/projects/${projectId}/upload-sessions/latest`,
      token,
    );
    const session = latest.item;
    if (session?.id !== previousSessionId && session?.status === 'completed') {
      return session;
    }
    if (
      session?.id !== previousSessionId &&
      ['partial_failed', 'finalization_failed', 'superseded'].includes(
        session?.status,
      )
    ) {
      throw new Error(
        `브라우저 업로드 세션이 ${session.status} 상태로 종료되었습니다: ${session.finalizationError || session.failedFiles?.join(', ') || '상세 오류 없음'}`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error('브라우저 업로드 세션 완료를 기다리다 시간 초과했습니다.');
}

function uploadSessionPayload(files) {
  const metadata = files
    .map((file) => ({
      relativePath: file.relativePath,
      size: file.content.length,
      sha256: createHash('sha256').update(file.content).digest('hex'),
    }))
    .sort((left, right) =>
      left.relativePath < right.relativePath
        ? -1
        : left.relativePath > right.relativePath
          ? 1
          : 0,
    );
  const manifest = createHash('sha256');
  for (const file of metadata) {
    manifest.update(`${file.relativePath}\0${file.size}\0${file.sha256}\n`);
  }
  const totalBytes = metadata.reduce((sum, file) => sum + file.size, 0);

  return {
    protocolVersion: 2,
    replace: true,
    totalFiles: metadata.length,
    totalBytes,
    filteredCount: 0,
    manifestDigest: `sha256:${manifest.digest('hex')}`,
    batches: [
      {
        index: 0,
        totalFiles: metadata.length,
        totalBytes,
        files: metadata,
      },
    ],
  };
}

async function createApiUploadSession(projectId, token, files) {
  return apiRequest(
    `/repository/projects/${projectId}/upload-sessions`,
    token,
    {
      method: 'POST',
      body: JSON.stringify(uploadSessionPayload(files)),
    },
  );
}

async function readLiveText(projectId, token, relativePath) {
  const result = await apiRequest(
    `/repository/projects/${projectId}/file?path=${encodeURIComponent(relativePath)}`,
    token,
  );
  assert.equal(result.encoding, 'utf8');
  return result.content;
}

async function verifyAtomicApiUpload(project, token) {
  const relativePath = 'atomic/state.txt';
  const baseline = [
    { relativePath, content: Buffer.from('before-source', 'utf8') },
  ];
  const replacement = [
    { relativePath, content: Buffer.from('after--source', 'utf8') },
  ];
  const tampered = [
    { relativePath, content: Buffer.from('wrong--source', 'utf8') },
  ];
  assert.equal(replacement[0].content.length, tampered[0].content.length);

  const baselineSession = await createApiUploadSession(
    project.id,
    token,
    baseline,
  );
  await apiMultipartRequest(
    `/repository/projects/${project.id}/upload-sessions/${baselineSession.id}/batches/0`,
    token,
    baseline,
  );
  const baselineFinalized = await apiRequest(
    `/repository/projects/${project.id}/upload-sessions/${baselineSession.id}/finalize`,
    token,
    { method: 'POST' },
  );
  assert.equal(baselineFinalized.session.status, 'completed');
  assert.equal(
    await readLiveText(project.id, token, relativePath),
    'before-source',
  );

  const replacementSession = await createApiUploadSession(
    project.id,
    token,
    replacement,
  );
  await assert.rejects(
    () =>
      apiMultipartRequest(
        `/repository/projects/${project.id}/upload-sessions/${replacementSession.id}/batches/0`,
        token,
        tampered,
      ),
    (error) => {
      assert.equal(error.status, 400);
      assert.equal(error.payload?.code, 'REPOSITORY_UPLOAD_INTEGRITY_MISMATCH');
      return true;
    },
  );
  assert.equal(
    await readLiveText(project.id, token, relativePath),
    'before-source',
  );

  const failedSession = await apiRequest(
    `/repository/projects/${project.id}/upload-sessions/${replacementSession.id}`,
    token,
  );
  assert.equal(failedSession.item.status, 'partial_failed');
  assert.equal(failedSession.item.batches[0].status, 'failed');

  const staged = await apiMultipartRequest(
    `/repository/projects/${project.id}/upload-sessions/${replacementSession.id}/batches/0`,
    token,
    replacement,
  );
  assert.equal(staged.session.status, 'finalizing');
  assert.equal(
    await readLiveText(project.id, token, relativePath),
    'before-source',
  );

  const finalized = await apiRequest(
    `/repository/projects/${project.id}/upload-sessions/${replacementSession.id}/finalize`,
    token,
    { method: 'POST' },
  );
  assert.equal(finalized.session.status, 'completed');
  assert.equal(
    await readLiveText(project.id, token, relativePath),
    'after--source',
  );
  console.log(
    '[repository-live-smoke] Atomic staging, integrity rejection, retry, and finalization verified.',
  );
}

function createProjectName() {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\..+/, '')
    .replace('T', '-');
  return `live-smoke-${stamp.toLowerCase()}`;
}

async function createFixtureDirectory(projectName) {
  const tempRoot = await fsp.mkdtemp(
    path.join(os.tmpdir(), 'kscold-control-upload-'),
  );
  const fixtureRoot = path.join(tempRoot, `${projectName}-fixture`);

  await fsp.mkdir(fixtureRoot, { recursive: true });

  const expectedPaths = [];
  const groups = [
    ['src/core', 48],
    ['src/features', 48],
    ['docs/guides', 28],
  ];

  let sequence = 1;
  for (const [directory, count] of groups) {
    const targetDirectory = path.join(fixtureRoot, directory);
    await fsp.mkdir(targetDirectory, { recursive: true });

    for (let index = 0; index < count; index += 1) {
      const fileName = `file-${String(sequence).padStart(3, '0')}.txt`;
      const relativePath = path.posix.join(directory, fileName);
      const payload = [
        `fixture project: ${projectName}`,
        `fixture file: ${relativePath}`,
        'This file exists to validate live repository upload flow.',
      ].join('\n');

      await fsp.writeFile(
        path.join(targetDirectory, fileName),
        payload,
        'utf8',
      );
      expectedPaths.push(relativePath);
      sequence += 1;
    }
  }

  return {
    tempRoot,
    fixtureRoot,
    expectedPaths,
  };
}

function findTreePath(node, targetPath, currentPath = '') {
  const nextPath =
    node.path ||
    (currentPath ? path.posix.join(currentPath, node.name) : node.name || '');

  if (nextPath === targetPath) {
    return true;
  }

  return (node.children || []).some((child) =>
    findTreePath(child, targetPath, nextPath === '.' ? '' : nextPath),
  );
}

async function run() {
  const { persistedState, token, user } = await createPersistedAdminAuthState();
  const projectName = createProjectName();
  const fixture = await createFixtureDirectory(projectName);
  let project = null;
  let browser = null;
  let page = null;

  console.log(`[repository-live-smoke] Base URL: ${baseUrl}`);
  console.log(`[repository-live-smoke] Authenticated as: ${user.email}`);

  try {
    project = await apiRequest('/repository/projects', token, {
      method: 'POST',
      body: JSON.stringify({
        name: projectName,
        description: 'Live repository upload smoke test',
      }),
    });
    console.log(`[repository-live-smoke] Created project: ${project.name}`);

    await verifyAtomicApiUpload(project, token);

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    page = await context.newPage();

    await page.addInitScript((value) => {
      window.localStorage.setItem('auth-storage', value);
    }, persistedState);

    await page.goto(`${baseUrl}/repository`, { waitUntil: 'networkidle' });
    await page.getByText(projectName, { exact: true }).click();
    await page.getByRole('button', { name: '업로드' }).click();

    const latestBeforeBrowserUpload = await apiRequest(
      `/repository/projects/${project.id}/upload-sessions/latest`,
      token,
    );
    await page.locator('input[type="file"]').setInputFiles(fixture.fixtureRoot);
    await page
      .getByTestId('repository-upload-ready')
      .waitFor({ state: 'visible', timeout: 30_000 });
    await page
      .getByRole('button', { name: /업로드 시작|남은 배치 이어올리기/ })
      .click();

    const activityCard = page.getByTestId('repository-upload-activity');
    await activityCard.waitFor({ state: 'visible', timeout: 30_000 });
    await page.waitForFunction(() => {
      const node = document.querySelector(
        '[data-testid="repository-upload-activity"]',
      );
      return Boolean(node && /배치|업로드/.test(node.textContent || ''));
    });
    const completedSession = await waitForCompletedUploadSession(
      project.id,
      token,
      latestBeforeBrowserUpload.item?.id ?? null,
    );
    assert.equal(completedSession.totalFiles, fixture.expectedPaths.length);
    await page.waitForFunction(() => {
      const node = document.querySelector(
        '[data-testid="repository-upload-activity"]',
      );
      return Boolean(
        node && /완료되었습니다|반영했습니다/.test(node.textContent || ''),
      );
    });

    await fsp.mkdir(path.dirname(screenshotPath), { recursive: true });
    await page.screenshot({ path: screenshotPath, fullPage: true });

    const tree = await apiRequest(
      `/repository/projects/${project.id}/tree`,
      token,
    );
    const samples = [
      fixture.expectedPaths[0],
      fixture.expectedPaths[Math.floor(fixture.expectedPaths.length / 2)],
      fixture.expectedPaths.at(-1),
    ].filter(Boolean);

    for (const samplePath of samples) {
      assert(
        findTreePath(tree, samplePath),
        `업로드된 파일을 트리에서 찾지 못했습니다: ${samplePath}`,
      );
    }

    console.log(
      `[repository-live-smoke] Upload verified with ${fixture.expectedPaths.length} files.`,
    );
    console.log(
      `[repository-live-smoke] Screenshot saved to ${screenshotPath}`,
    );
  } catch (error) {
    if (page) {
      await fsp.mkdir(path.dirname(screenshotPath), { recursive: true });
      const failureScreenshot = screenshotPath.replace(
        /\.png$/i,
        '-failed.png',
      );
      await page.screenshot({ path: failureScreenshot, fullPage: true });
      const activityText = await page
        .getByTestId('repository-upload-activity')
        .textContent()
        .catch(() => null);
      console.error(
        `[repository-live-smoke] Browser activity: ${activityText || 'not available'}`,
      );
      console.error(
        `[repository-live-smoke] Failure screenshot saved to ${failureScreenshot}`,
      );
    }
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }

    if (project?.id) {
      try {
        await apiRequest(`/repository/projects/${project.id}`, token, {
          method: 'DELETE',
        });
        console.log(
          `[repository-live-smoke] Deleted smoke project: ${project.name}`,
        );
      } catch (error) {
        console.error(
          `[repository-live-smoke] Failed to delete smoke project: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    await fsp.rm(fixture.tempRoot, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(
    `[repository-live-smoke] FAILED: ${error instanceof Error ? error.stack || error.message : String(error)}`,
  );
  process.exitCode = 1;
});
