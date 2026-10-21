import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { chromium, expect } from '@playwright/test';
import { preview } from 'vite';

const root = fileURLToPath(new URL('../../apps/frontend/', import.meta.url));
const user = {
  id: 'bundle-test-user',
  email: 'bundle-test@example.invalid',
  roles: ['viewer'],
  permissions: ['terminal:access', 'repository:read'],
};

test(
  'production bundle loads lazy routes and the terminal without a backend',
  {
    timeout: 60_000,
  },
  async (t) => {
    const server = await preview({
      root,
      configFile: false,
      preview: { host: '127.0.0.1', port: 0 },
    });
    t.after(
      () =>
        new Promise((resolve, reject) => {
          server.httpServer.close((error) =>
            error ? reject(error) : resolve(),
          );
          server.httpServer.closeAllConnections();
        }),
    );
    const baseURL = `http://127.0.0.1:${server.httpServer.address().port}`;
    const browser = await chromium.launch();
    t.after(() => browser.close());
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const errors = [];
    const unexpectedApiCalls = [];

    // No production API, WebSocket, credentials, or database is used in this check.
    await context.routeWebSocket('**', (socket) => socket.close());
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== baseURL) return route.abort();
      if (!url.pathname.startsWith('/api/')) return route.continue();
      if (
        route.request().method() === 'GET' &&
        url.pathname === '/api/auth/me'
      ) {
        return route.fulfill({ json: user });
      }
      if (
        route.request().method() === 'GET' &&
        url.pathname === '/api/repository/projects'
      ) {
        return route.fulfill({ json: { items: [] } });
      }
      if (
        route.request().method() === 'GET' &&
        url.pathname === '/api/terminal/workspace-tree'
      ) {
        return route.fulfill({
          json: {
            root: {
              name: 'fixture',
              path: '.',
              type: 'directory',
              children: [],
            },
            changes: [],
            git: { enabled: false, rootPath: null, branch: null },
            ship: {
              gitEnabled: false,
              branch: null,
              defaultBaseBranch: null,
              trackingBranch: null,
              isOnDefaultBranch: false,
              hasRemoteTracking: false,
              remoteUrl: null,
              compareUrl: null,
              changedCount: 0,
              stagedCount: 0,
              lastCommit: null,
              draft: {
                title: '',
                body: '',
                compareUrl: null,
                branch: null,
                baseBranch: null,
                canOpen: false,
              },
            },
          },
        });
      }
      unexpectedApiCalls.push(`${route.request().method()} ${url.pathname}`);
      return route.fulfill({
        status: 503,
        json: { message: 'No backend in bundle test' },
      });
    });

    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('response', (response) => {
      if (response.url().startsWith(`${baseURL}/assets/`) && !response.ok()) {
        errors.push(`Asset ${response.status()}: ${response.url()}`);
      }
    });

    await page.goto(`${baseURL}/login`);
    await expect(
      page.getByRole('heading', { name: 'kscold-control', exact: true }),
    ).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();

    const assets = await readdir(`${root}/dist/assets`);
    for (const vendor of [
      'react',
      'xterm',
      'reactflow',
      'socket',
      'markdown',
    ]) {
      assert.ok(
        assets.some(
          (name) =>
            name.startsWith(`vendor-${vendor}-`) && name.endsWith('.js'),
        ),
      );
    }
    // Import every emitted chunk so missing exports and circular initialization fail here.
    const chunks = assets.filter(
      (name) => name.endsWith('.js') && !name.startsWith('index-'),
    );
    await page.evaluate(async (names) => {
      for (const name of names) await import(`/assets/${name}`);
    }, chunks);

    await page.evaluate((testUser) => {
      localStorage.setItem(
        'auth-storage',
        JSON.stringify({
          state: {
            token: 'bundle-test-not-a-real-token',
            user: testUser,
            impersonation: null,
          },
          version: 0,
        }),
      );
    }, user);
    await page.goto(`${baseURL}/repository`);
    await expect(
      page.getByRole('heading', { name: '소스 저장소', exact: true }),
    ).toBeVisible();
    await page.goto(`${baseURL}/terminal`);
    await expect(
      page.getByRole('heading', { name: 'Claude Code Workspace', exact: true }),
    ).toBeVisible();
    await expect(page.locator('.xterm-screen')).toBeVisible();
    await expect(page.locator('.xterm-helper-textarea')).toHaveCount(1);
    await expect
      .poll(async () =>
        page.locator('.xterm-screen').evaluate((element) => {
          const box = element.getBoundingClientRect();
          return box.width > 0 && box.height > 0;
        }),
      )
      .toBe(true);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('.xterm-screen')).toBeVisible();
    await expect
      .poll(async () =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);
    assert.deepEqual(unexpectedApiCalls, []);
    assert.deepEqual(errors, []);
    await context.close();
  },
);
