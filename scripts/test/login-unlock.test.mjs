import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { BlockList } from 'node:net';
import { join } from 'node:path';
import test from 'node:test';
import * as backendPolicy from '../../apps/backend/src/security/domain/login-guard/login-block.policy.ts';
import * as backendClientIp from '../../apps/backend/src/common/utils/client-ip.util.ts';
import {
  auditLogPath,
  firewallEntriesFor,
  loginIpGroup,
  normalizeIp,
  normalizeLoginAccount,
  unlockGroup,
} from '../lib/login-unlock.mjs';

const noProxies = { proxies: new BlockList(), secret: null };
const backendGroup = (raw) =>
  backendPolicy.loginIpGroup(
    backendClientIp.clientIp(
      { headers: {}, socket: { remoteAddress: raw } },
      noProxies,
    ),
  );

const randomIpv6 = () =>
  Array.from({ length: 8 }, () => randomBytes(2).toString('hex')).join(':');

test('IP 를 백엔드가 기록하는 대역과 똑같이 묶는다', () => {
  const inputs = [
    '203.0.113.7',
    ' 203.0.113.7 ',
    '::ffff:203.0.113.7',
    '::FFFF:203.0.113.7',
    '2001:DB8:1:2:abcd::1',
    '2001:0db8:0001:0002:ffff:ffff:ffff:ffff',
    '2001:db8:0:0:1::1',
    '2001:db8:1:2::192.0.2.4',
    '::192.0.2.4',
    'fe80::1%en0',
    '::1',
    '::',
    'not-an-ip',
    '',
    `2001:db8::${'1'.repeat(80)}`,
    ...Array.from({ length: 2000 }, randomIpv6),
    ...Array.from({ length: 200 }, () => randomIpv6().toUpperCase()),
  ];
  for (const raw of inputs) {
    assert.equal(loginIpGroup(normalizeIp(raw)), backendGroup(raw), raw);
  }
});

test('계정 이름을 백엔드와 똑같이 맞춘다 (BMP 전체 문자)', () => {
  for (let code = 0; code <= 0xffff; code++) {
    const email = ` Ad${String.fromCharCode(code)}min@Example.com `;
    assert.equal(
      normalizeLoginAccount(email),
      backendPolicy.normalizeLoginAccount(email),
      `U+${code.toString(16)}`,
    );
  }
});

test('같은 /64 의 다른 주소나 대소문자만 다른 표기를 같은 대역으로 푼다', () => {
  const group = '2001:db8:1:2::/64';
  for (const value of [
    '2001:db8:1:2::5',
    '2001:DB8:1:2:ffff::9',
    '2001:0db8:0001:0002::/64',
    '2001:db8:1:2:abcd::/64',
  ]) {
    assert.equal(unlockGroup(value), group, value);
  }
  assert.equal(unlockGroup('::ffff:203.0.113.7'), '203.0.113.7');
  assert.equal(unlockGroup('203.0.113.7'), '203.0.113.7');
  for (const value of ['203.0.113.0/24', '2001:db8::/48', '2001:db8::/0x40']) {
    assert.equal(unlockGroup(value), null, value);
  }
});

test('방화벽 목록에서 대상과 겹치는 항목만 알려 준다', () => {
  const files = {
    manual: [
      '# 메모',
      '2001:db8:1:2::/64\t2026-11-10 17:00:00\tControl 로그인 실패 20회',
      '198.51.100.0/24\t2026-11-10 17:00:00\t',
    ],
    auto: [
      '203.0.113.7\t2026-11-10 17:00:00\t-\troot',
      '2001:db8:1:2::9\t2026-11-10 17:00:00\t-\troot',
    ],
    release: ['2001:db8:1:2::9'],
  };

  assert.deepEqual(firewallEntriesFor('2001:db8:1:2::/64', files), [
    { ip: '2001:db8:1:2::/64', source: 'manual' },
  ]);
  assert.deepEqual(firewallEntriesFor('198.51.100.9', files), [
    { ip: '198.51.100.0/24', source: 'manual' },
  ]);
  assert.deepEqual(firewallEntriesFor('203.0.113.7', files), [
    { ip: '203.0.113.7', source: 'auto' },
  ]);
  assert.deepEqual(firewallEntriesFor('203.0.113.8', files), []);
});

test('백엔드와 같은 감사 기록 파일을 고른다', () => {
  const expected = join(
    '/srv/control',
    'apps',
    'backend',
    'data',
    'audit-log.jsonl',
  );
  assert.equal(auditLogPath('/srv/control'), expected);
  assert.equal(auditLogPath(join('/srv/control', 'apps', 'backend')), expected);
});
