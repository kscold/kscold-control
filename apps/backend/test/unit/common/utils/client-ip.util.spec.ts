import {
  clientIp,
  parseProxySecret,
  parseTrustedProxies,
  type ProxyTrust,
} from '@/common/utils/client-ip.util';

const SECRET = 'a'.repeat(64);

function request(
  remoteAddress: string | undefined,
  realIp?: string,
  extraHeaders: Record<string, string> = {},
) {
  return {
    headers: {
      ...(realIp === undefined ? {} : { 'x-real-ip': realIp }),
      ...extraHeaders,
    },
    socket: { remoteAddress },
  };
}

function trustOf(proxies: string | undefined, secret: string | null = null) {
  return { proxies: parseTrustedProxies(proxies), secret } satisfies ProxyTrust;
}

describe('clientIp', () => {
  const loopbackOnly = trustOf(undefined);

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
    const trusted = trustOf('10.0.0.0/24, 2001:db8::1');

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

  it.each([' , ', ',', '   '])(
    '항목이 없는 설정 %p 은 비운 것과 같이 루프백만 믿는다',
    (raw) => {
      const trusted = trustOf(raw);

      expect(clientIp(request('127.0.0.1', '203.0.113.9'), trusted)).toBe(
        '203.0.113.9',
      );
      expect(clientIp(request('::1', '203.0.113.9'), trusted)).toBe(
        '203.0.113.9',
      );
      expect(clientIp(request('10.0.0.7', '203.0.113.9'), trusted)).toBe(
        '10.0.0.7',
      );
    },
  );

  it('IPv6 zone id 는 떼고 저장 칸보다 긴 값은 버린다', () => {
    expect(clientIp(request('127.0.0.1', 'fe80::1%eth0'), loopbackOnly)).toBe(
      'fe80::1',
    );
    expect(clientIp(request('fe80::9%en0', undefined), loopbackOnly)).toBe(
      'fe80::9',
    );
    const long = `fe80::1%${'x'.repeat(80)}`;
    expect(clientIp(request('127.0.0.1', long), loopbackOnly)).toBe(
      '127.0.0.1',
    );
    expect(clientIp(request(long), loopbackOnly)).toBe(null);
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

  describe('CONTROL_PROXY_SECRET 을 쓸 때', () => {
    const withSecret = trustOf(undefined, SECRET);

    it('비밀값이 맞는 루프백 요청의 X-Real-IP 만 믿는다', () => {
      expect(
        clientIp(
          request('127.0.0.1', '203.0.113.9', {
            'x-control-proxy-secret': SECRET,
          }),
          withSecret,
        ),
      ).toBe('203.0.113.9');
    });

    it('비밀값이 없거나 틀린 루프백 요청의 X-Real-IP 는 무시한다', () => {
      expect(clientIp(request('127.0.0.1', '203.0.113.9'), withSecret)).toBe(
        '127.0.0.1',
      );
      expect(
        clientIp(
          request('127.0.0.1', '203.0.113.9', {
            'x-control-proxy-secret': `${SECRET}x`,
          }),
          withSecret,
        ),
      ).toBe('127.0.0.1');
      expect(
        clientIp(
          request('127.0.0.1', '203.0.113.9', { 'x-control-proxy-secret': '' }),
          withSecret,
        ),
      ).toBe('127.0.0.1');
    });

    it('비밀값이 맞아도 믿지 않는 주소에서 오면 소켓 주소를 쓴다', () => {
      expect(
        clientIp(
          request('198.51.100.20', '203.0.113.9', {
            'x-control-proxy-secret': SECRET,
          }),
          withSecret,
        ),
      ).toBe('198.51.100.20');
    });

    it('비밀값이 짧으면 기동을 멈추고 비우면 확인하지 않는다', () => {
      expect(() => parseProxySecret('short')).toThrow('CONTROL_PROXY_SECRET');
      expect(parseProxySecret('  ')).toBe(null);
      expect(parseProxySecret(undefined)).toBe(null);
      expect(parseProxySecret(` ${SECRET} `)).toBe(SECRET);
    });
  });

  it('요청 첫 단계에서 IP 를 정한 뒤 비밀값 헤더를 지워도 같은 IP 를 돌려준다', () => {
    const env = { ...process.env };
    process.env.CONTROL_PROXY_SECRET = SECRET;
    delete process.env.CONTROL_TRUSTED_PROXIES;
    try {
      jest.isolateModules(() => {
        const fresh = jest.requireActual<
          typeof import('@/common/utils/client-ip.util')
        >('@/common/utils/client-ip.util');
        const proxied = request('127.0.0.1', '203.0.113.9', {
          'x-control-proxy-secret': SECRET,
        });
        const forged = request('127.0.0.1', '203.0.113.9');
        const next = jest.fn();

        fresh.resolveClientIpAndDropProxySecret(proxied, undefined, next);
        fresh.resolveClientIpAndDropProxySecret(forged, undefined, next);

        expect(next).toHaveBeenCalledTimes(2);
        expect(proxied.headers).not.toHaveProperty('x-control-proxy-secret');
        expect(fresh.clientIp(proxied)).toBe('203.0.113.9');
        expect(fresh.clientIp(forged)).toBe('127.0.0.1');
      });
    } finally {
      process.env = env;
    }
  });
});
