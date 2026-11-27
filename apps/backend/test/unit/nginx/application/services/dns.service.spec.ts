import { DnsService } from '@/nginx/application/services/dns.service';

describe('DnsService', () => {
  it('첫 공급자 실패 시 다음 공급자의 주소를 조회하고 캐시한다', async () => {
    const lookupPublicIp = vi
      .fn()
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockResolvedValueOnce('192.0.2.10');
    const service = new DnsService({
      lookupPublicIp,
      resolveAddresses: async () => [],
      resolveAliases: async () => [],
    });

    await expect(service.getPublicIp()).resolves.toBe('192.0.2.10');
    await expect(service.getPublicIp()).resolves.toBe('192.0.2.10');
    expect(lookupPublicIp.mock.calls).toEqual([['ipify'], ['ifconfig']]);
  });

  it('별칭의 IPv4가 서버 주소로 해석되면 DNS 확인에 성공한다', async () => {
    const service = new DnsService({
      lookupPublicIp: async () => '192.0.2.10',
      resolveAddresses: async () => ['192.0.2.10'],
      resolveAliases: async () => ['alias.example.com'],
    });

    await expect(service.verifyDns('app.example.com')).resolves.toEqual({
      allOk: true,
      domain: 'app.example.com',
      publicIp: '192.0.2.10',
      records: [
        {
          type: 'CNAME',
          host: 'app',
          value: 'alias.example.com',
          actual: '192.0.2.10',
          status: 'ok',
        },
      ],
    });
  });
});
