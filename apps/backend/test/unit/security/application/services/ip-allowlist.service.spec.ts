import {
  IpAllowlistService,
  parseSecurityAllowlist,
} from '@/security/application/services/ip-allowlist.service';

function allowlistOf(raw: string) {
  const previous = process.env.SECURITY_ALLOWLIST;
  process.env.SECURITY_ALLOWLIST = raw;
  try {
    return new IpAllowlistService();
  } finally {
    if (previous === undefined) delete process.env.SECURITY_ALLOWLIST;
    else process.env.SECURITY_ALLOWLIST = previous;
  }
}

describe('IpAllowlistService', () => {
  it.each([
    '198.51.100.0/0x10',
    '198.51.100.0/00',
    '198.51.100.0/016',
    '198.51.100.0/33',
    '2001:db8::/129',
    '198.51.100.0/',
    '198.51.100.0/24/8',
    '198.51.100.256',
    'example.com',
  ])('읽을 수 없는 항목 %s 이 있으면 기동을 멈춘다', (entry) => {
    expect(() => parseSecurityAllowlist(`192.0.2.1,${entry}`)).toThrow(
      'SECURITY_ALLOWLIST',
    );
    expect(() => allowlistOf(entry)).toThrow('SECURITY_ALLOWLIST');
  });

  it('IPv6 주소 끝의 IPv4 표기를 따로 읽어 다른 주소와 섞지 않는다', () => {
    const allowlist = allowlistOf('::192,2001:db8::c000:205');

    expect(allowlist.isListed('::192.0.2.4')).toBe(false);
    expect(allowlist.isListed('::192')).toBe(true);
    expect(allowlist.isListed('2001:db8::192.0.2.5')).toBe(true);
    expect(allowlist.isListed('2001:db8::192.0.2.6')).toBe(false);
  });

  it('/16·/48 보다 넓은 대역은 차단에서 보호만 하고 로그인 예외로 쓰지 않는다', () => {
    const allowlist = allowlistOf(
      '198.51.100.0/15,2001:db8::/32,203.0.113.0/16,2001:db8:1::/48',
    );

    expect(allowlist.isListed('198.51.100.5')).toBe(false);
    expect(allowlist.isProtected('198.51.100.5', null).protected).toBe(true);
    expect(allowlist.isListed('2001:db8:2::5')).toBe(false);
    expect(allowlist.isProtected('2001:db8:2::5', null).protected).toBe(true);
    expect(allowlist.isListed('203.0.113.9')).toBe(true);
    expect(allowlist.isListed('2001:db8:1::5')).toBe(true);
  });

  it('대역 차단은 보호 대역과 겹치면 막지 않는다', () => {
    const allowlist = allowlistOf('2001:db8:1:2::9');

    expect(allowlist.isProtected('2001:db8:1:2::/64', null)).toMatchObject({
      protected: true,
    });
    expect(allowlist.isProtected('2001:db8:1:3::/64', null)).toEqual({
      protected: false,
    });
    expect(allowlist.isProtected('fd00:1:2:3::/64', null).protected).toBe(true);
    expect(allowlist.isProtected('203.0.113.7', null)).toEqual({
      protected: false,
    });
    expect(allowlist.isProtected('10.1.2.3', null).protected).toBe(true);
  });
});
