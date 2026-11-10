import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';
import { preview } from 'vite';

test(
  '원격 화면 최대화와 접기 및 메뉴 순서를 실제 브라우저에서 확인함',
  { timeout: 60_000 },
  async (t) => {
    const root = fileURLToPath(
      new URL('../../apps/frontend/', import.meta.url),
    );
    const server = await preview({
      root,
      configFile: false,
      preview: { host: '127.0.0.1', port: 0 },
    });
    t.after(
      () =>
        new Promise((resolve) => {
          server.httpServer.close(resolve);
          server.httpServer.closeAllConnections();
        }),
    );
    const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
    const browser = await chromium.launch();
    t.after(() => browser.close());
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const user = {
      id: 'test',
      email: 'admin@example.invalid',
      roles: ['admin'],
      permissions: ['dashboard:read', 'terminal:access', 'secrets:read'],
    };
    await context.addInitScript(
      (user) =>
        localStorage.setItem(
          'auth-storage',
          JSON.stringify({
            state: { token: 'test-token', user, impersonation: null },
            version: 0,
          }),
        ),
      user,
    );
    // 운영 API와 실제 VNC에는 접속하지 않고 화면 공간만 검증함.
    await context.route('**/*', (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      if (url.pathname === '/api/auth/me') return route.fulfill({ json: user });
      if (url.pathname === '/api/remote-desktop/targets')
        return route.fulfill({
          json: [
            { id: 'local', name: '맥미니', port: 5900, hasCredentials: false },
          ],
        });
      if (url.pathname.startsWith('/api/'))
        return route.fulfill({ status: 403, json: {} });
      return route.continue();
    });
    const page = await context.newPage();
    await page.goto(`${origin}/remote-desktop`);
    const links = page.locator('nav a');
    await expect(links.nth(0)).toHaveText('대시보드');
    await expect(links.nth(1)).toHaveText('원격 데스크톱');
    const target = page.getByRole('region', { name: '원격 화면' });
    await expect(page.getByRole('button', { name: '도구 접기' })).toBeVisible();
    const initial = await target.boundingBox();
    await page.screenshot({ path: '/tmp/control-remote-desktop.png' });
    await page.getByRole('button', { name: '접속 대상', exact: true }).click();
    await expect(
      page.getByRole('complementary', { name: '접속 대상 관리' }),
    ).toBeVisible();
    await expect
      .poll(async () => (await target.boundingBox()).height)
      .toBe(initial.height);
    await page.getByRole('button', { name: '접속 대상 닫기' }).click();
    await page.getByRole('button', { name: '도구 접기' }).click();
    await expect
      .poll(async () => (await target.boundingBox()).height)
      .toBe(900);
    await expect
      .poll(async () => (await target.boundingBox()).width)
      .toBe(1440);
    await page.getByRole('button', { name: '클립보드', exact: true }).click();
    await expect(page.getByLabel('클립보드 텍스트')).toBeVisible();
    await expect
      .poll(async () => (await target.boundingBox()).height)
      .toBe(900);
    await page.getByRole('button', { name: '화면 복원' }).click();
    await expect(page.getByRole('button', { name: '도구 접기' })).toBeVisible();
    await page.getByRole('button', { name: '전체 화면', exact: true }).click();
    await expect
      .poll(() => page.evaluate(() => Boolean(document.fullscreenElement)))
      .toBe(true);
    await page.evaluate(() => document.exitFullscreen());
    await expect(page.getByRole('button', { name: '도구 접기' })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect.poll(async () => (await target.boundingBox()).width).toBe(390);
    await expect
      .poll(
        async () =>
          (await page.locator('.desktop-connect-card').boundingBox()).width,
      )
      .toBeLessThanOrEqual(362);
    await expect
      .poll(async () => {
        const card = await page.locator('.desktop-connect-card').boundingBox();
        return card.x + card.width;
      })
      .toBeLessThanOrEqual(390);
    await page.screenshot({
      path: '/tmp/control-remote-mobile-normal.png',
      animations: 'disabled',
    });
    await page.getByRole('button', { name: '도구 접기' }).click();
    await expect
      .poll(async () => (await target.boundingBox()).height)
      .toBe(844);
    await expect.poll(async () => (await target.boundingBox()).width).toBe(390);
    await expect(page.getByRole('button', { name: '화면 복원' })).toBeVisible();
    await page.screenshot({ path: '/tmp/control-remote-mobile.png' });
  },
);
