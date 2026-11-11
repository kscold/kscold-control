import { clientIp, parseTrustedProxies } from '@/common/utils/client-ip.util';

function request(remoteAddress: string | undefined, realIp?: string) {
  return {
    headers: realIp === undefined ? {} : { 'x-real-ip': realIp },
    socket: { remoteAddress },
  };
}

describe('clientIp', () => {
  const loopbackOnly = parseTrustedProxies(undefined);

  it('루프백 프록시가 보낸 X-Real-IP 를 사용자 IP 로 쓴다', () => {
    expect(clientIp(request('127.0.0.1', '203.0.113.9'), loopbackOnly)).toBe(
      '203.0.113.9',
    );
    expect(clientIp(request('::1', '2001:db8::9'), loopbackOnly)).toBe(
      '2001:db8::9',
    );
  });

  it('IPv6 소켓에 담긴 루프백도 믿는 프록시로 본다', () => {
    expect(
      clientIp(request('::ffff:127.0.0.1', '203.0.113.9'), loopbackOnly),
    ).toBe('203.0.113.9');
  });

  it('믿지 않는 주소가 보낸 X-Real-IP 는 무시하고 소켓 주소를 쓴다', () => {
    expect(
      clientIp(request('198.51.100.20', '203.0.113.9'), loopbackOnly),
    ).toBe('198.51.100.20');
    expect(
      clientIp(request('::ffff:198.51.100.20', '127.0.0.1'), loopbackOnly),
    ).toBe('198.51.100.20');
  });

  it('X-Forwarded-For 는 믿는 프록시에서 와도 쓰지 않는다', () => {
    const forwarded = {
      headers: { 'x-forwarded-for': '203.0.113.9' },
      socket: { remoteAddress: '127.0.0.1' },
    };
    expect(clientIp(forwarded, loopbackOnly)).toBe('127.0.0.1');
  });

  it('IP 형식이 아닌 X-Real-IP 는 버리고 소켓 주소를 쓴다', () => {
    expect(clientIp(request('127.0.0.1', 'not-an-ip'), loopbackOnly)).toBe(
      '127.0.0.1',
    );
    expect(
      clientIp(request('127.0.0.1', '203.0.113.9, 198.51.100.1'), loopbackOnly),
    ).toBe('127.0.0.1');
  });

  it('소켓 주소를 모르면 null 이다', () => {
    expect(clientIp(request(undefined, '203.0.113.9'), loopbackOnly)).toBe(
      null,
    );
  });

  it('설정한 대역의 프록시만 믿는다', () => {
    const trusted = parseTrustedProxies('10.0.0.0/24, 2001:db8::1');

    expect(clientIp(request('10.0.0.7', '203.0.113.9'), trusted)).toBe(
      '203.0.113.9',
    );
    expect(clientIp(request('2001:db8::1', '203.0.113.9'), trusted)).toBe(
      '203.0.113.9',
    );
    expect(clientIp(request('127.0.0.1', '203.0.113.9'), trusted)).toBe(
      '127.0.0.1',
    );
    expect(clientIp(request('10.0.1.7', '203.0.113.9'), trusted)).toBe(
      '10.0.1.7',
    );
  });

  it.each([
    'example.com',
    '10.0.0.0/33',
    '10.0.0.0/8/1',
    '2001:db8::/129',
    '10.0.0.0/x',
  ])('읽을 수 없는 신뢰 프록시 설정 %s 은 기동을 멈춘다', (raw) => {
    expect(() => parseTrustedProxies(raw)).toThrow('CONTROL_TRUSTED_PROXIES');
  });
});
