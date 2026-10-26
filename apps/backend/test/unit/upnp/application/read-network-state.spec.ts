import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { GetExternalIpUseCase } from '@/upnp/application/use-cases/get-external-ip.use-case';
import { ListPortMappingsUseCase } from '@/upnp/application/use-cases/list-port-mappings.use-case';
import { UpnpQueryError } from '@/upnp/domain/errors/upnp-query.error';
import type { IUpnpGatewayRepository } from '@/upnp/domain/repositories/upnp-gateway.repository';

describe('UPnP 조회 실패 응답', () => {
  const gateway = {
    getExternalIp: jest.fn(),
    getMappings: jest.fn(),
    addMapping: jest.fn(),
    removeMapping: jest.fn(),
  } satisfies IUpnpGatewayRepository;
  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('실제 빈 목록은 그대로 반환함', async () => {
    gateway.getMappings.mockResolvedValue([]);
    await expect(
      new ListPortMappingsUseCase(gateway).execute(),
    ).resolves.toEqual([]);
  });

  it.each(['ip', 'mappings'])(
    '%s 탐색 실패를 500이나 빈 성공으로 위장하지 않음',
    async (kind) => {
      gateway.getExternalIp.mockRejectedValue(
        new UpnpQueryError('UPNP_UNAVAILABLE'),
      );
      gateway.getMappings.mockRejectedValue(
        new UpnpQueryError('UPNP_UNAVAILABLE'),
      );
      const useCase =
        kind === 'ip'
          ? new GetExternalIpUseCase(gateway)
          : new ListPortMappingsUseCase(gateway);
      const error = await useCase.execute().catch((failure) => failure);
      expect(error).toBeInstanceOf(ServiceUnavailableException);
      expect(error.getStatus()).toBe(503);
      expect(error.getResponse()).toMatchObject({ code: 'UPNP_UNAVAILABLE' });
    },
  );

  it('서버 경로·응답 본문이 들어 있는 하위 예외를 노출하지 않음', async () => {
    gateway.getExternalIp.mockRejectedValue(new Error('fixture-never-log'));
    const error = await new GetExternalIpUseCase(gateway)
      .execute()
      .catch((failure) => failure);
    expect(error.getResponse()).toMatchObject({ code: 'UPNP_QUERY_FAILED' });
    expect(JSON.stringify(error.getResponse())).not.toContain(
      'fixture-never-log',
    );
    expect(
      JSON.stringify(jest.mocked(Logger.prototype.warn).mock.calls),
    ).not.toContain('fixture-never-log');
  });
});
