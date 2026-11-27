#!/usr/bin/env node
/**
 * 휴대폰 폭에서 모든 화면을 열어 가로 넘침·안쪽 상자 가로 넘침을 찾는다.
 * 읽기만 한다: GET 외 API 요청과 실시간 소켓은 막는다.
 *
 * 사용: CONTROL_QA_TOKEN=<짧은 관리자 토큰> node scripts/check-mobile-layout.mjs [기준주소] [폭]
 *   기준주소 기본값 http://localhost:3000 (vite dev 는 /api 를 백엔드로 넘긴다)
 * 넘침이 하나라도 있으면 1 로 끝나 배포 전 검사에 쓸 수 있다.
 */
import { chromium, devices } from '@playwright/test';

const base = (process.argv[2] || 'http://localhost:3000').replace(/\/$/, '');
// 아이폰 SE·작은 안드로이드 폭. 사파리 글꼴이 크롬보다 넓어 여유를 두려고 좁게 잰다
const width = Number(process.argv[3] || 360);
const token = process.env.CONTROL_QA_TOKEN;
if (!token) {
  console.error('CONTROL_QA_TOKEN 이 필요합니다 (관리자 접근 토큰).');
  process.exit(2);
}

const ROUTES = [
  '/',
  '/remote-desktop',
  '/keys',
  '/terminal',
  '/docker',
  '/rbac',
  '/logs',
  '/nginx',
  '/network',
  '/topology',
  '/repository',
  '/backups',
  '/maintenance',
  '/audit',
  '/security',
  '/account',
];

const meRes = await fetch(`${base}/api/auth/me`, {
  headers: { Authorization: `Bearer ${token}` },
});
if (!meRes.ok) {
  console.error(
    `토큰 확인 실패 (${meRes.status}). 만료됐거나 다른 서버의 토큰입니다.`,
  );
  process.exit(2);
}
const me = await meRes.json();
const user = me.user ?? me;

const browser = await chromium.launch();
const context = await browser.newContext({
  ...devices['iPhone 13'],
  viewport: { width, height: 844 },
});
await context.addInitScript(
  ([t, u]) => {
    localStorage.setItem(
      'auth-storage',
      JSON.stringify({
        state: { token: t, user: u, impersonation: null },
        version: 0,
      }),
    );
  },
  [token, user],
);
await context.route('**/api/**', (route) => {
  const req = route.request();
  return req.method() === 'GET' || req.url().includes('/auth/refresh')
    ? route.continue()
    : route.abort();
});
await context.routeWebSocket(/socket\.io/, (ws) => ws.close());

const page = await context.newPage();
let problems = 0;
for (const path of ROUTES) {
  await page.goto(base + path, { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(1200);
  const found = await page.evaluate(() => {
    const vw = innerWidth;
    const out = [];
    const clippedByAncestor = (el) => {
      for (let a = el.parentElement; a; a = a.parentElement) {
        const s = getComputedStyle(a);
        if (
          /(auto|scroll|hidden)/.test(s.overflowX) &&
          a !== document.body &&
          a !== document.documentElement
        )
          return true;
      }
      return false;
    };
    const label = (e) =>
      `${e.tagName.toLowerCase()}.${String(e.className).slice(0, 60)}`;
    if (document.documentElement.scrollWidth > vw + 1)
      out.push(
        `페이지가 화면보다 넓음 ${document.documentElement.scrollWidth}>${vw}`,
      );
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width && r.right > vw + 1 && !clippedByAncestor(el))
        out.push(`화면 밖으로 나감 ${label(el)} right=${Math.round(r.right)}`);
      const s = getComputedStyle(el);
      // 일부러 옆으로 미는 줄(탭·키 막대·코드)은 overflow-x-auto 로 표시해 둔다
      if (
        /(auto|scroll)/.test(s.overflowX) &&
        el.clientWidth > 0 &&
        el.scrollWidth > el.clientWidth + 2 &&
        !el.closest('.xterm') &&
        !/overflow-x-auto|overflow-x-scroll|font-mono|whitespace-pre/.test(
          String(el.className),
        )
      ) {
        out.push(
          `안쪽 상자가 옆으로 넘침 ${label(el)} ${el.scrollWidth}>${el.clientWidth}`,
        );
      }
    }
    return [...new Set(out)].slice(0, 8);
  });
  if (found.length) {
    problems += found.length;
    console.log(`✗ ${path}\n  ${found.join('\n  ')}`);
  } else {
    console.log(`✓ ${path}`);
  }
}
await browser.close();
if (problems) {
  console.log(
    `\n${problems}곳에서 넘침. 흔한 원인: flex 자식에 min-w-0 없음, 긴 해시·이메일에 break-all/truncate 없음, grid 에 grid-cols-1 기본값 없음.`,
  );
  process.exit(1);
}
console.log('\n휴대폰 폭 넘침 없음');
