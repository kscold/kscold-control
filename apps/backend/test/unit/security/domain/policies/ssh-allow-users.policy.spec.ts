import { parseSshAllowUsers } from '@/security/domain/policies/ssh-allow-users.policy';

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
