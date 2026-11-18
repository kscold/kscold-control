import type { Mock } from 'vitest';
import { EventEmitter } from 'events';
import * as dgram from 'dgram';
import { searchSsdp } from '@/upnp/infrastructure/ssdp-discovery';

vi.mock('dgram', () => ({ createSocket: vi.fn() }));

describe('SSDP 소켓 수명', () => {
  let socket: EventEmitter & {
    bind: Mock;
    send: Mock;
    close: Mock;
  };
  beforeEach(() => {
    vi.useFakeTimers();
    socket = Object.assign(new EventEmitter(), {
      bind: vi.fn((callback) => callback()),
      send: vi.fn(),
      close: vi.fn(),
    });
    vi.mocked(dgram.createSocket).mockReturnValue(
      socket as unknown as dgram.Socket,
    );
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  it('응답 성공 시 타이머와 소켓을 한 번만 정리함', async () => {
    const result = searchSsdp('test-target');
    socket.emit(
      'message',
      Buffer.from('LOCATION: http://192.0.2.1/root.xml\r\n'),
    );
    await expect(result).resolves.toBe('http://192.0.2.1/root.xml');
    socket.emit(
      'message',
      Buffer.from('LOCATION: http://192.0.2.2/root.xml\r\n'),
    );
    vi.advanceTimersByTime(5000);
    expect(socket.close).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['error', 'send', 'bind', 'timeout'])(
    '%s 실패도 열린 소켓이나 타이머를 남기지 않음',
    async (kind) => {
      if (kind === 'bind')
        socket.bind.mockImplementation(() => {
          throw new Error('bind failed');
        });
      const result = searchSsdp('test-target');
      const assertion = expect(result).rejects.toBeInstanceOf(Error);
      if (kind === 'error') socket.emit('error', new Error('socket failed'));
      if (kind === 'send')
        socket.send.mock.calls[0][5](new Error('send failed'));
      if (kind === 'timeout') vi.advanceTimersByTime(4000);
      await assertion;
      expect(socket.close).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
    },
  );
});
