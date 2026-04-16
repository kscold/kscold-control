import { test, expect } from '@playwright/test';
import { createPersistedAdminAuthState } from './support/control-auth';

let authStorageValue = '';
const apiBaseUrl = 'http://127.0.0.1:4410';

test.beforeAll(async () => {
  authStorageValue = await createPersistedAdminAuthState(apiBaseUrl);
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript((value) => {
    window.localStorage.setItem('auth-storage', value);
  }, authStorageValue);
});

test('대시보드에서 Docker 상세 수치를 확인할 수 있다', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Docker 저장소 세부 내역' }),
  ).toBeVisible();
  await expect(page.getByText('엔진 내부 Docker')).toBeVisible();
  await expect(page.getByText('재확보 가능')).toBeVisible();
});

test('Docker 관리 화면에서 정리 후보를 미리보기로 확인할 수 있다', async ({
  page,
}) => {
  await page.goto('/docker');

  await expect(
    page.getByRole('heading', { name: '정리 후보와 안전 정리' }),
  ).toBeVisible();

  await page.getByRole('button', { name: '예상 절감량 보기' }).first().click();

  await expect(page.getByRole('heading', { name: /정리/ })).toBeVisible();
  await expect(page.getByText('예상 절감 용량')).toBeVisible();
  await page.getByRole('button', { name: '확인' }).click();
});

test('토폴로지 화면에서 서버 스냅샷 기반 구조도를 렌더링한다', async ({
  page,
}) => {
  await page.goto('/topology');

  await expect(page.getByText('Infrastructure Topology')).toBeVisible();
  await expect(
    page.getByRole('button', { name: '토폴로지 새로고침' }),
  ).toBeVisible();
  await expect(page.getByTestId('rf__node-internet')).toContainText('Internet');
  await expect(page.getByText('Mac Mini (Host)')).toBeVisible();
});

test('터미널 화면에서 Claude Code 워크스페이스를 렌더링한다', async ({
  page,
}) => {
  await page.goto('/terminal');

  await expect(
    page.getByRole('heading', { name: 'Claude Code Workspace' }),
  ).toBeVisible();
  await expect(page.getByTestId('claude-code-terminal')).toBeVisible();

  await page.getByRole('button', { name: '런타임 패널 열기' }).click();
  await expect(page.getByTestId('claude-runtime-check')).toBeVisible();

  await page.getByRole('button', { name: '파일 패널 열기' }).click();
  await expect(page.getByTestId('claude-workspace-files')).toBeVisible();
  await expect(page.getByTestId('claude-workspace-tree')).toBeVisible();
  await expect(page.getByTestId('claude-ship-controls')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Create Branch' }),
  ).toBeVisible();
  await expect(page.getByTestId('claude-pr-draft')).toBeVisible();
});

test('로그 화면에서 Docker live와 archive 소스 패널을 렌더링한다', async ({
  page,
}) => {
  await page.goto('/logs');

  await expect(page.getByRole('heading', { name: '시스템 로그' })).toBeVisible();
  await page.getByRole('combobox').first().selectOption('docker');

  await expect(page.getByText('Log Sources')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Live' })).toBeVisible();
  await expect(page.getByRole('button', { name: '소스 새로고침' })).toBeVisible();
  await expect(page.getByText(/live stream과 회전된 docker json-file/)).toBeVisible();
});
