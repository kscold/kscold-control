// unlock-login.mjs 가 쓰는 순수 함수. 백엔드가 기록에 적는 값과 똑같이 만들어야 같은 행을 찾는다.
// scripts/test/login-unlock.test.mjs 가 백엔드 원본(login-block.policy.ts, client-ip.util.ts)과 결과를 견준다.
import { randomUUID } from 'node:crypto';
import { BlockList, isIP } from 'node:net';
import { join } from 'node:path';

const INVISIBLE_CHARS =
  // eslint-disable-next-line no-control-regex -- 제어 문자를 지우려는 것이다.
  /[\u0000-\u001f\u007f-\u009f​-‍‪-‮⁦-⁩﻿]/g;
const MAX_IP_INPUT_LENGTH = 64;

export function normalizeLoginAccount(email) {
  return email.replace(INVISIBLE_CHARS, '').trim().toLowerCase().slice(0, 320);
}

/** client-ip.util normalizeIp 와 같다. */
export function normalizeIp(value) {
  const trimmed = value?.trim();
  if (!trimmed || trimmed.length > MAX_IP_INPUT_LENGTH) return null;
  const withoutZone = trimmed.split('%')[0];
  const mapped = /^::ffff:/i.test(withoutZone) ? withoutZone.slice(7) : null;
  const address = mapped && isIP(mapped) === 4 ? mapped : withoutZone;
  return isIP(address) ? address : null;
}

/** login-block.policy loginIpGroup 과 같다. */
export function loginIpGroup(ip) {
  const address = ip?.split('%')[0] ?? null;
  if (!address || isIP(address) !== 6) return address;
  const canonical = new URL(`http://[${address}]`).hostname.slice(1, -1);
  const [head, tail = ''] = canonical.split('::');
  const left = head ? head.split(':') : [];
  const right = tail ? tail.split(':') : [];
  const groups = [
    ...left,
    ...Array(8 - left.length - right.length).fill('0'),
    ...right,
  ];
  const network = new URL(`http://[${groups.slice(0, 4).join(':')}::]`)
    .hostname;
  return `${network.slice(1, -1)}/64`;
}

/**
 * 명령줄 대상을 login_attempts.ip_group·ip_bans.ip 에 적힌 값으로 바꾼다.
 * IP 하나나 IPv6 /64 대역만 받는다. 백엔드가 그 밖의 단위로 세거나 막지 않기 때문이다.
 */
export function unlockGroup(value) {
  const [address, prefix, ...rest] = value.trim().split('/');
  const ip = normalizeIp(address);
  if (!ip || rest.length > 0) return null;
  if (prefix === undefined) return loginIpGroup(ip);
  return prefix === '64' && isIP(ip) === 6 ? loginIpGroup(ip) : null;
}

function rangeOf(value) {
  const [address, prefix, ...rest] = value.trim().split('/');
  const version = isIP(address);
  if (!version || rest.length > 0) return null;
  const max = version === 4 ? 32 : 128;
  if (prefix !== undefined && !/^(0|[1-9]\d{0,2})$/.test(prefix)) return null;
  const bits = prefix === undefined ? max : Number(prefix);
  if (bits > max) return null;
  const family = version === 4 ? 'ipv4' : 'ipv6';
  const list = new BlockList();
  list.addSubnet(address, bits, family);
  return { address, family, list };
}

function overlaps(a, b) {
  return (
    a.family === b.family &&
    (a.list.check(b.address, b.family) || b.list.check(a.address, a.family))
  );
}

/**
 * 방화벽 차단 목록(SshAccessService 와 같은 파일 형식)에서 대상과 겹치는 항목.
 * 차단기에 해제를 요청해 둔(ssh-block-release.txt) 자동 항목은 뺀다.
 */
export function firewallEntriesFor(group, files) {
  const target = rangeOf(group);
  if (!target) return [];
  const releasing = new Set(files.release.map((line) => line.trim()));
  const entries = [
    ...files.manual
      .filter((line) => !line.trim().startsWith('#'))
      .map((line) => ({ ip: line.split('\t')[0].trim(), source: 'manual' })),
    ...files.auto
      .map((line) => ({ ip: line.split('\t')[0].trim(), source: 'auto' }))
      .filter((entry) => !releasing.has(entry.ip)),
  ];
  return entries.filter((entry) => {
    const range = rangeOf(entry.ip);
    return range !== null && overlaps(range, target);
  });
}

/** FileAuditLogRepository 와 같은 자리. 백엔드는 apps/backend 에서, 이 스크립트는 저장소 루트에서 돈다. */
export function auditLogPath(cwd) {
  const backendRoot = cwd.endsWith(join('apps', 'backend'))
    ? cwd
    : join(cwd, 'apps', 'backend');
  return join(backendRoot, 'data', 'audit-log.jsonl');
}

/** FileAuditLogRepository.append 가 쓰는 한 줄과 같은 모양 */
export function unlockAuditLine({ targetType, targetId, summary, metadata }) {
  return `${JSON.stringify({
    id: randomUUID(),
    domain: 'security',
    action: 'login.unlock',
    summary,
    actorId: null,
    actorEmail: null,
    targetType,
    targetId,
    metadata,
    createdAt: new Date().toISOString(),
  })}\n`;
}
