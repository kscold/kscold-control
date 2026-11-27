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
    !/^[a-zA-Z0-9_]/.test(user) ||
    /[^a-zA-Z0-9_.-]/.test(user) ||
    !source ||
    /[^a-fA-F0-9:./]/.test(source) ||
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

export interface SshAllowUsersChange {
  kind: 'add' | 'remove';
  rule: string;
}

export type SshAllowUsersChangePlan =
  | { kind: 'changed'; config: string }
  | { kind: 'unchanged' }
  | { kind: 'protected' }
  | { kind: 'unsupported' }
  | { kind: 'invalid-rule' };

export function planSshAllowUsersChange(
  config: string,
  protectedRule: string,
  change: SshAllowUsersChange,
): SshAllowUsersChangePlan {
  if (!parseSshAllowUsersRule(change.rule)) return { kind: 'invalid-rule' };
  const policy = parseSshAllowUsers(config);
  if (policy.kind === 'unsupported') return { kind: 'unsupported' };
  const has = (pattern: string) =>
    policy.kind === 'managed' &&
    policy.rules.some(({ user, source }) => `${user}@${source}` === pattern);
  if (
    !has(protectedRule) ||
    (change.kind === 'remove' && change.rule === protectedRule)
  ) {
    return { kind: 'protected' };
  }
  const lineEnding = config.includes('\r\n') ? '\r\n' : '\n';
  if (change.kind === 'add') {
    if (has(change.rule)) return { kind: 'unchanged' };
    const separator = config.endsWith('\n') ? '' : lineEnding;
    return {
      kind: 'changed',
      config: `${config}${separator}AllowUsers ${change.rule}${lineEnding}`,
    };
  }
  if (!has(change.rule)) return { kind: 'unchanged' };

  const lines = config.split(/(\r?\n)/);
  for (let index = 0; index < lines.length; index += 2) {
    const line = lines[index];
    const commentAt = line.indexOf('#');
    const body = commentAt < 0 ? line : line.slice(0, commentAt);
    const tokens = body.match(/[^ \t]+/g) ?? [];
    if (!tokens.slice(1).includes(change.rule)) continue;
    const remaining = tokens.slice(1).filter((rule) => rule !== change.rule);
    if (remaining.length === 0) {
      lines[index] = commentAt < 0 ? '' : line.slice(commentAt);
    } else {
      const comment = commentAt < 0 ? '' : ` ${line.slice(commentAt)}`;
      lines[index] = `${tokens[0]} ${remaining.join(' ')}${comment}`;
    }
  }
  return { kind: 'changed', config: lines.join('') };
}
