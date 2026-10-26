import { createServer, type Server, type ServerResponse } from 'http';
import type { AddressInfo } from 'net';
import { requestGateway } from '@/upnp/infrastructure/gateway-http';

describe('UPnP HTTP 자원 제한', () => {
  let server: Server;
  let port: number;
  const start = async (handler: (response: ServerResponse) => void) => {
    server = createServer((_request, response) => handler(response));
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    port = (server.address() as AddressInfo).port;
  };
  afterEach(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections();
    });
  });

  it('정상 응답과 HTTP 500 SOAP 종료 응답을 구별해 전달함', async () => {
    const xml = '<UPnPError><errorCode>713</errorCode></UPnPError>';
    await start((response) => {
      response.statusCode = 500;
      response.end(xml);
    });
    await expect(
      requestGateway({ host: '127.0.0.1', port, method: 'POST' }, '<request/>'),
    ).resolves.toBe(xml);
    await expect(requestGateway({ host: '127.0.0.1', port })).rejects.toThrow(
      'HTTP failure',
    );
  });
  it('멈추지 않는 응답도 전체 시간 제한으로 종료함', async () => {
    await start((response) => {
      const interval = setInterval(() => response.write('chunk'), 10);
      response.on('close', () => clearInterval(interval));
    });
    await expect(
      requestGateway({ host: '127.0.0.1', port }, undefined, 100),
    ).rejects.toThrow('timeout');
  });
  it('과도하게 큰 응답을 메모리에 계속 쌓지 않음', async () => {
    await start((response) => response.end('x'.repeat(1024 * 1024 + 1)));
    await expect(requestGateway({ host: '127.0.0.1', port })).rejects.toThrow(
      'too large',
    );
  });
  it('중간에 끊긴 응답은 성공으로 취급하지 않음', async () => {
    await start((response) => {
      response.write('<partial>');
      response.destroy();
    });
    await expect(requestGateway({ host: '127.0.0.1', port })).rejects.toThrow();
  });
});
