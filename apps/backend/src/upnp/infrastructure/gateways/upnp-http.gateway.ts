import * as http from 'http';

/** 응답이 조금씩 계속 와도 전체 대기 시간과 메모리 사용량을 제한함. */
export function requestGateway(
  options: http.RequestOptions,
  body?: string,
  timeoutMs = 5000,
): Promise<string> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error, data?: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) {
        request.destroy();
        reject(error);
      } else resolve(data!);
    };
    const request = http.request(options, (response) => {
      const chunks: Buffer[] = [];
      let size = 0;
      response.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > 1024 * 1024)
          return finish(new Error('UPnP response too large'));
        chunks.push(chunk);
      });
      response.on('error', () => finish(new Error('UPnP response error')));
      response.on('aborted', () => finish(new Error('UPnP response aborted')));
      response.on('end', () => {
        const data = Buffer.concat(chunks).toString('utf8');
        const status = response.statusCode ?? 0;
        // SOAP의 목록 끝(713)도 HTTP 500으로 오므로 본문을 호출자가 판별함.
        if (
          (status < 200 || status >= 300) &&
          !(body && /<(?:[\w]+:)?(?:Fault|UPnPError)\b/.test(data))
        ) {
          finish(new Error('UPnP HTTP failure'));
        } else finish(undefined, data);
      });
    });
    const timeout = setTimeout(
      () => finish(new Error('UPnP request timeout')),
      timeoutMs,
    );
    request.on('error', () => finish(new Error('UPnP connection failed')));
    request.end(body);
  });
}
