import { createSocket } from 'node:dgram';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import {
  defaultBroadcast,
  isPrivateIPv4,
  magicPacket,
  normalizeMac,
} from '../../../src/remote-desktop/remote-desktop-network';

describe('원격 대상 망 규칙', () => {
  it('사설 IPv4 세 대역만 허용한다', () => {
    for (const ok of [
      '10.0.0.1',
      '172.16.0.1',
      '172.31.255.254',
      '192.168.1.9',
    ])
      expect(isPrivateIPv4(ok)).toBe(true);
    for (const bad of [
      '192.0.2.10',
      '127.0.0.1',
      '172.15.0.1', // public-source-allow: 사설 대역 경계 확인용
      '192.169.0.1', // public-source-allow: 사설 대역 경계 확인용
      '010.0.0.1',
      'localhost',
      '::1',
    ])
      expect(isPrivateIPv4(bad)).toBe(false);
  });

  it('MAC 주소는 콜론·하이픈 형식만 받아 소문자 콜론으로 맞춘다', () => {
    expect(normalizeMac('00-00-5E-00-53-01')).toBe('00:00:5e:00:53:01');
    expect(normalizeMac('00:00:5e:00:53:01')).toBe('00:00:5e:00:53:01');
    expect(normalizeMac('00:00-5e:00:53:01')).toBeNull();
    expect(normalizeMac('00005e005301')).toBeNull();
    expect(normalizeMac('00:00:5e:00:53:zz')).toBeNull();
  });

  it('브로드캐스트 기본값은 같은 /24 의 .255 이다', () => {
    expect(defaultBroadcast('10.0.0.42')).toBe('10.0.0.255');
  });

  it('매직 패킷은 0xFF 6바이트 뒤에 MAC 16번이다', () => {
    const packet = magicPacket('00:00:5e:00:53:01');
    const mac = Buffer.from([0x00, 0x00, 0x5e, 0x00, 0x53, 0x01]);
    expect(packet).toHaveLength(102);
    expect(packet.subarray(0, 6)).toEqual(Buffer.alloc(6, 0xff));
    for (let index = 0; index < 16; index += 1)
      expect(packet.subarray(6 + index * 6, 12 + index * 6)).toEqual(mac);
  });

  it('UDP로 받은 바이트가 매직 패킷과 같다', async () => {
    const receiver = createSocket('udp4');
    receiver.bind(0, '127.0.0.1');
    await once(receiver, 'listening');
    const sender = createSocket('udp4');
    const packet = magicPacket('00:00:5e:00:53:01');
    sender.send(packet, (receiver.address() as AddressInfo).port, '127.0.0.1');
    const [received] = await once(receiver, 'message');
    expect(received).toEqual(packet);
    sender.close();
    receiver.close();
  });
});
