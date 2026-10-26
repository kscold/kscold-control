import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';
import { chromium, expect } from '@playwright/test';
import { preview } from 'vite';

test(
  '네트워크 화면의 복구·모바일·진단 비식별화를 실제 브라우저에서 검증함',
  { timeout: 60_000 },
  async (t) => {
    const server = await preview({
      root: fileURLToPath(new URL('../../apps/frontend/', import.meta.url)),
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
    const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
    const browser = await chromium.launch();
    t.after(() => browser.close());
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    let unavailable = true;
    const diagnostics = [];
    const unexpected = [];
    const user = {
      id: 'network-test-user',
      email: 'reader@example.invalid',
      roles: ['viewer'],
      permissions: ['system:read'],
    };
    await context.addInitScript((user) => {
      localStorage.setItem(
        'auth-storage',
        JSON.stringify({
          state: {
            token: 'network-fixture-not-a-real-token',
            user,
            impersonation: null,
          },
          version: 0,
        }),
      );
    }, user);
    // 실제 공유기·운영 API·DB에는 접속하지 않음.
    await context.routeWebSocket('**', (socket) => socket.close());
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      if (!url.pathname.startsWith('/api/')) return route.continue();
      if (url.pathname === '/api/auth/me') return route.fulfill({ json: user });
      if (url.pathname === '/api/logs/frontend-error') {
        diagnostics.push(route.request().postDataJSON());
        return route.fulfill({ json: { ok: true, recorded: true } });
      }
      if (
        url.pathname.startsWith('/api/upnp/') &&
        route.request().method() === 'GET'
      ) {
        if (unavailable)
          return route.fulfill({
            status: 503,
            json: {
              code: 'UPNP_UNAVAILABLE',
              message: 'UPnP 게이트웨이에 연결할 수 없습니다.',
            },
          });
        return route.fulfill({
          json: url.pathname.endsWith('external-ip')
            ? { ip: '203.0.113.1' }
            : [
                {
                  publicPort: 8080,
                  privatePort: 80,
                  protocol: 'TCP',
                  privateHost: '192.0.2.2',
                  description:
                    'Example application with a longer description for mobile layout',
                  enabled: true,
                  local: false,
                  ttl: 0,
                },
              ],
        });
      }
      unexpected.push(`${route.request().method()} ${url.pathname}`);
      return route.abort();
    });
    const page = await context.newPage();
    await page.goto(
      `${origin}/network?private=fixture-never-send#fixture-never-send`,
    );
    await expect(page.getByRole('alert')).toContainText(
      '기존 설정은 변경하지 않았습니다',
    );
    await expect(page.getByText('확인 불가', { exact: true })).toHaveCount(2);
    await expect(
      page.getByRole('button', { name: '포트 매핑 추가' }),
    ).toHaveCount(0);
    unavailable = false;
    await page.getByRole('button', { name: '다시 조회' }).click();
    await expect(page.getByText('203.0.113.1')).toBeVisible();
    await expect(page.getByText('1개', { exact: true })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /매핑 삭제/ })).toHaveCount(
      0,
    );

    const screenshot = async (name) => {
      if (!process.env.CONTROL_UI_ARTIFACT_DIR) return;
      await mkdir(process.env.CONTROL_UI_ARTIFACT_DIR, { recursive: true });
      await page.screenshot({
        path: path.join(process.env.CONTROL_UI_ARTIFACT_DIR, name),
        fullPage: true,
        animations: 'disabled',
      });
    };
    await screenshot('network-desktop.png');
    await page.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(async () => {
        const box = await page.locator('aside').boundingBox();
        return box.x + box.width <= 1;
      })
      .toBe(true);
    await expect(page.getByTestId('network-dashboard')).toBeVisible();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      true,
    );
    await expect(page.getByText('192.0.2.2:80')).toBeVisible();
    await screenshot('network-mobile.png');

    unavailable = true;
    await page.getByRole('button', { name: '상태 새로고침' }).click();
    await expect(
      page.getByText(
        '이전 조회 결과입니다. 상태 확인 전까지 변경 작업이 잠깁니다.',
      ),
    ).toBeVisible();
    await expect(page.getByRole('alert')).toBeVisible();
    await screenshot('network-failure-mobile.png');

    await page.evaluate(() => {
      window.dispatchEvent(
        new ErrorEvent('error', { error: new TypeError('fixture-never-send') }),
      );
      const event = new Event('unhandledrejection');
      Object.defineProperty(event, 'reason', {
        value: new Error('fixture-never-send'),
      });
      window.dispatchEvent(event);
    });
    await expect.poll(() => diagnostics.length).toBe(2);
    assert.equal(
      JSON.stringify(diagnostics).includes('fixture-never-send'),
      false,
    );
    assert.ok(
      diagnostics.every(
        (item) =>
          item.route === '/network' && /^\d+\.\d+\.\d+$/.test(item.release),
      ),
    );
    assert.deepEqual(diagnostics.map((item) => item.kind).sort(), [
      'runtime',
      'unhandled-rejection',
    ]);
    assert.deepEqual(unexpected, []);
    await context.close();
  },
);
