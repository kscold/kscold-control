import * as dgram from 'dgram';

export function searchSsdp(target: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket('udp4');
    let settled = false;
    const finish = (error?: Error, location?: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      try {
        socket.close();
      } catch {
        /* bind 전 실패한 소켓도 종료 경로를 통일함. */
      }
      if (error) reject(error);
      else resolve(location!);
    };
    const timeout = setTimeout(() => finish(new Error('SSDP timeout')), 4000);
    const message = Buffer.from(
      'M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\n' +
        `MAN: "ssdp:discover"\r\nMX: 3\r\nST: ${target}\r\n\r\n`,
    );
    socket.on('message', (buffer) => {
      const location = buffer
        .toString()
        .match(/^LOCATION:\s*(.+)$/im)?.[1]
        ?.trim();
      if (location) finish(undefined, location);
    });
    socket.on('error', (error) => finish(error));
    try {
      socket.bind(() => {
        if (settled) return;
        try {
          socket.send(
            message,
            0,
            message.length,
            1900,
            '239.255.255.250',
            (error) => {
              if (error) finish(error);
            },
          );
        } catch (error) {
          finish(error as Error);
        }
      });
    } catch (error) {
      finish(error as Error);
    }
  });
}
