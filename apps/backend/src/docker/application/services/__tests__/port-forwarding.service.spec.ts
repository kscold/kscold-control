import { PortForwardingService } from '../port-forwarding.service';
import type { IUpnpGatewayRepository } from '../../../../upnp/domain/interfaces/upnp-gateway.repository';

describe('PortForwardingService', () => {
  let service: PortForwardingService;
  let gateway: jest.Mocked<IUpnpGatewayRepository>;

  beforeEach(() => {
    gateway = {
      getMappings: jest.fn(),
      addMapping: jest.fn().mockResolvedValue(undefined),
      removeMapping: jest.fn().mockResolvedValue(undefined),
      getExternalIp: jest.fn().mockResolvedValue('203.0.113.10'),
    };
    service = new PortForwardingService(gateway);
  });

  it('uses the shared UPnP gateway for mapping and external IP operations', async () => {
    await service.addPortMapping(8080, 3000, 'blog-8080');
    await service.removePortMapping(3000);

    expect(gateway.addMapping).toHaveBeenCalledWith({
      publicPort: 3000,
      privatePort: 8080,
      description: 'blog-8080',
    });
    expect(gateway.removeMapping).toHaveBeenCalledWith(3000, 'TCP');
    await expect(gateway.getExternalIp()).resolves.toBe('203.0.113.10');
  });

  it('continues when a router rejects a mapping request', async () => {
    gateway.addMapping.mockRejectedValueOnce(new Error('router unavailable'));
    gateway.removeMapping.mockRejectedValueOnce(
      new Error('router unavailable'),
    );

    await expect(
      service.addPortMapping(8080, 3000, 'blog-8080'),
    ).resolves.toBeUndefined();
    await expect(service.removePortMapping(3000)).resolves.toBeUndefined();
  });

  it('forwards all declared container ports', async () => {
    await service.addPortForwardingRules('blog', {
      '8080': 3000,
      '22': 2222,
    });

    expect(gateway.addMapping).toHaveBeenCalledTimes(2);
    expect(gateway.addMapping).toHaveBeenCalledWith({
      publicPort: 3000,
      privatePort: 8080,
      description: 'blog-8080',
    });
    expect(gateway.addMapping).toHaveBeenCalledWith({
      publicPort: 2222,
      privatePort: 22,
      description: 'blog-22',
    });
  });

  it('keeps the configured domain in external access links', () => {
    expect(service.getExternalAccess({ '22': 2222, '80': 3000 })).toEqual({
      domain: 'kscold.iptime.org',
      ssh: 'ssh root@kscold.iptime.org -p 2222',
      http: 'http://kscold.iptime.org:3000',
    });
  });
});
