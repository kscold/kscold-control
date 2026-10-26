import { UpnpGatewayRepositoryImpl } from '@/upnp/infrastructure/repositories/upnp-gateway.repository.impl';
import { searchSsdp } from '@/upnp/infrastructure/ssdp-discovery';

jest.mock('@/upnp/infrastructure/ssdp-discovery', () => ({
  searchSsdp: jest.fn(),
}));
const gateway = {
  host: '192.0.2.1',
  port: 80,
  controlUrl: '/control',
  serviceType: 'urn:schemas-upnp-org:service:WANIPConnection:1',
};
const entry =
  '<NewExternalPort>8080</NewExternalPort><NewInternalPort>80</NewInternalPort><NewProtocol>TCP</NewProtocol><NewInternalClient>192.0.2.2</NewInternalClient>';
const end = '<UPnPError><errorCode>713</errorCode></UPnPError>';

describe('UPnP 목록의 완전성', () => {
  let repository: UpnpGatewayRepositoryImpl;
  let soap: jest.SpyInstance;
  beforeEach(() => {
    repository = new UpnpGatewayRepositoryImpl();
    jest.spyOn(repository as any, 'discoverGateway').mockResolvedValue(gateway);
    soap = jest.spyOn(repository as any, 'soapCall');
  });
  afterEach(() => jest.restoreAllMocks());

  it('713만 정상적인 목록 끝으로 처리함', async () => {
    soap.mockResolvedValueOnce(entry).mockResolvedValueOnce(end);
    await expect(repository.getMappings()).resolves.toHaveLength(1);
  });
  it('첫 번째 713은 정상적인 빈 목록임', async () => {
    soap.mockResolvedValue(end);
    await expect(repository.getMappings()).resolves.toEqual([]);
  });
  it.each([
    '<Fault><errorCode>401</errorCode></Fault>',
    '<html>502 Bad Gateway</html>',
    '<NewExternalPort>0</NewExternalPort>',
  ])('잘못된 응답을 빈 목록으로 처리하지 않음', async (response) => {
    soap.mockResolvedValue(response);
    await expect(repository.getMappings()).rejects.toMatchObject({
      code: 'UPNP_QUERY_FAILED',
    });
  });
  it('중간 통신 실패 시 부분 목록을 완전한 목록으로 반환하지 않음', async () => {
    soap
      .mockResolvedValueOnce(entry)
      .mockRejectedValueOnce(new Error('timeout'));
    await expect(repository.getMappings()).rejects.toMatchObject({
      code: 'UPNP_QUERY_FAILED',
    });
  });
  it('최대 개수에 도달하면 잘린 결과를 반환하지 않음', async () => {
    soap.mockResolvedValue(entry);
    await expect(repository.getMappings()).rejects.toMatchObject({
      code: 'UPNP_QUERY_FAILED',
    });
    expect(soap).toHaveBeenCalledTimes(101);
  });
  it('IP 형식이 아닌 내용을 주소로 표시하지 않음', async () => {
    soap.mockResolvedValue(
      '<NewExternalIPAddress>untrusted</NewExternalIPAddress>',
    );
    await expect(repository.getExternalIp()).rejects.toMatchObject({
      code: 'UPNP_QUERY_FAILED',
    });
  });
});

describe('UPnP 탐색 병합', () => {
  afterEach(() => jest.restoreAllMocks());
  it('동시 IP·목록 조회가 하나의 탐색을 공유함', async () => {
    const repository = new UpnpGatewayRepositoryImpl();
    jest.mocked(searchSsdp).mockResolvedValue('http://192.0.2.1/root.xml');
    jest
      .spyOn(repository as any, 'httpGet')
      .mockResolvedValue(
        `<service><serviceType>${gateway.serviceType}</serviceType><controlURL>/control</controlURL></service>`,
      );
    jest
      .spyOn(repository as any, 'soapCall')
      .mockImplementation((...args: unknown[]) =>
        String(args[3]).endsWith('GetExternalIPAddress')
          ? Promise.resolve(
              '<NewExternalIPAddress>203.0.113.1</NewExternalIPAddress>',
            )
          : Promise.resolve(end),
      );
    await Promise.all([repository.getExternalIp(), repository.getMappings()]);
    expect(searchSsdp).toHaveBeenCalledTimes(1);
  });
});
