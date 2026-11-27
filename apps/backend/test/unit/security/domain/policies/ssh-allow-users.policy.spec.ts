import {
  parseSshAllowUsers,
  planSshAllowUsersChange,
} from '@/security/domain/policies/ssh-allow-users.policy';

describe('SSH AllowUsers 정책 파일', () => {
  it('주석과 여러 줄에 나뉜 IP 및 CIDR 규칙을 읽는다', () => {
    expect(
      parseSshAllowUsers(
        '# SSH access\r\nAllowUsers operator@192.0.2.10 # office\r\n' +
          '  allowusers\toperator@198.51.100.0/24 operator@2001:db8::/64\r\n',
      ),
    ).toEqual({
      kind: 'managed',
      rules: [
        { user: 'operator', source: '192.0.2.10' },
        { user: 'operator', source: '198.51.100.0/24' },
        { user: 'operator', source: '2001:db8::/64' },
      ],
    });
  });

  it.each([
    ['# no policy\n', undefined],
    ['AllowUsers\n', 1],
    ['AllowUsers operator\n', 1],
    ['AllowUsers operator@*.example.com\n', 1],
    ['AllowUsers operator@192.0.2.10,!192.0.2.20\n', 1],
    ['AllowUsers operator@192.0.2.10\nMatch User operator\n', 2],
    ['Include another.conf\n', 1],
  ])('부분적인 규칙 목록을 반환하지 않는다 (%j)', (config, line) => {
    expect(parseSshAllowUsers(config)).toEqual(
      line === undefined ? { kind: 'empty' } : { kind: 'unsupported', line },
    );
  });
});

describe('SSH 허용 규칙 변경 후보', () => {
  const protectedRule = 'operator@192.0.2.10';
  const removable = 'operator@198.51.100.0/24';
  const config = `# policy\nAllowUsers ${protectedRule} ${removable} # office\n`;

  it('추가할 때 기존 규칙과 주석을 보존한다', () => {
    expect(
      planSshAllowUsersChange(config, protectedRule, {
        kind: 'add',
        rule: 'operator@2001:db8::/64',
      }),
    ).toEqual({
      kind: 'changed',
      config: `${config}AllowUsers operator@2001:db8::/64\n`,
    });
  });

  it('삭제할 때 같은 줄의 다른 규칙과 주석을 보존한다', () => {
    expect(
      planSshAllowUsersChange(config, protectedRule, {
        kind: 'remove',
        rule: removable,
      }),
    ).toEqual({
      kind: 'changed',
      config: `# policy\nAllowUsers ${protectedRule} # office\n`,
    });
  });

  it('보호 규칙을 제거하거나 보호 규칙을 알 수 없는 파일을 편집하지 않는다', () => {
    expect(
      planSshAllowUsersChange(config, protectedRule, {
        kind: 'remove',
        rule: protectedRule,
      }),
    ).toEqual({ kind: 'protected' });
    expect(
      planSshAllowUsersChange(`AllowUsers ${removable}\n`, protectedRule, {
        kind: 'remove',
        rule: removable,
      }),
    ).toEqual({ kind: 'protected' });
  });

  it.each(['\nMatch all', '\n'])(
    '개행이 포함된 입력을 거부한다 (%j)',
    (suffix) => {
      expect(
        planSshAllowUsersChange(config, protectedRule, {
          kind: 'add',
          rule: `${removable}${suffix}`,
        }),
      ).toEqual({ kind: 'invalid-rule' });
    },
  );

  it('이미 있는 규칙을 추가하거나 없는 규칙을 삭제하면 파일을 다시 쓰지 않는다', () => {
    expect(
      planSshAllowUsersChange(config, protectedRule, {
        kind: 'add',
        rule: removable,
      }),
    ).toEqual({ kind: 'unchanged' });
    expect(
      planSshAllowUsersChange(config, protectedRule, {
        kind: 'remove',
        rule: 'operator@203.0.113.1',
      }),
    ).toEqual({ kind: 'unchanged' });
  });
});
