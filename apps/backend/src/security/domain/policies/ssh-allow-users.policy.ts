import { parseIpRange } from '../value-objects/ip-range.vo';

export interface SshAllowUsersRule {
  user: string;
  source: string;
}

export type SshAllowUsersPolicy =
  | { kind: 'empty' }
  | { kind: 'managed'; rules: SshAllowUsersRule[] }
  | { kind: 'unsupported'; line: number };

export function parseSshAllowUsersRule(
  value: string,
): SshAllowUsersRule | null {
  const [user, source, ...rest] = value.split('@');
  if (
    rest.length ||
    !/^[a-zA-Z0-9_][a-zA-Z0-9_.-]*$/.test(user) ||
    !source ||
    !/^[a-fA-F0-9:./]+$/.test(source) ||
    !parseIpRange(source)
  ) {
    return null;
  }
  return { user, source };
}

export function parseSshAllowUsers(config: string): SshAllowUsersPolicy {
  const rules: SshAllowUsersRule[] = [];

  // 일부만 읽으면 저장할 때 지원하지 않는 OpenSSH 규칙을 잃을 수 있다.
  for (const [index, raw] of config.split(/\r?\n/).entries()) {
    const text = raw
      .trim()
      .replace(/(^|[ \t]+)#.*$/, '')
      .trimEnd();
    if (!text) continue;
    const [directive, ...patterns] = text.split(/[ \t]+/);
    if (directive.toLowerCase() !== 'allowusers' || patterns.length === 0) {
      return { kind: 'unsupported', line: index + 1 };
    }
    for (const pattern of patterns) {
      const rule = parseSshAllowUsersRule(pattern);
      if (!rule) return { kind: 'unsupported', line: index + 1 };
      rules.push(rule);
    }
  }

  return rules.length ? { kind: 'managed', rules } : { kind: 'empty' };
}
