import { createSocket } from 'node:dgram';
import { Socket } from 'node:net';

const OCTET = '(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)';
const IPV4 = new RegExp(`^${OCTET}(\\.${OCTET}){3}$`);
const MAC = /^[0-9a-f]{2}([:-])[0-9a-f]{2}(\1[0-9a-f]{2}){4}$/i;

// 사설 IPv4 숫자 주소만 허용함. 호스트 이름은 DNS 응답에 따라 망 밖으로 나갈 수 있어 받지 않음.
export function isPrivateIPv4(value: string): boolean {
  if (!IPV4.test(value)) return false;
  const [a, b] = value.split('.').map(Number);
  return (
    a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
  );
}

export function normalizeMac(value: string): string | null {
  return MAC.test(value) ? value.toLowerCase().replace(/-/g, ':') : null;
}

export function defaultBroadcast(host: string): string {
  return `${host.split('.').slice(0, 3).join('.')}.255`;
}

export function magicPacket(mac: string): Buffer {
  const bytes = Buffer.from(mac.replace(/[:-]/g, ''), 'hex');
  return Buffer.concat([
    Buffer.alloc(6, 0xff),
    ...Array.from({ length: 16 }, () => bytes),
  ]);
}

export async function sendMagicPacket(mac: string, broadcast: string) {
  const socket = createSocket('udp4');
  const packet = magicPacket(mac);
  try {
    await new Promise<void>((resolve, reject) => {
      socket.once('error', reject);
      socket.bind(() => {
        socket.setBroadcast(true);
        resolve();
      });
    });
    // 장비마다 듣는 포트가 달라 9번(discard)과 7번(echo)에 모두 보냄.
    for (const port of [9, 7])
      await new Promise<void>((resolve, reject) =>
        socket.send(packet, port, broadcast, (error) =>
          error ? reject(error) : resolve(),
        ),
      );
  } finally {
    socket.close();
  }
}

export function probeTcp(host: string, port: number, timeout = 1_500) {
  return new Promise<boolean>((resolve) => {
    const socket = new Socket();
    const finish = (online: boolean) => {
      socket.destroy();
      resolve(online);
    };
    socket.setTimeout(timeout, () => finish(false));
    socket.once('error', () => finish(false));
    socket.connect(port, host, () => finish(true));
  });
}
