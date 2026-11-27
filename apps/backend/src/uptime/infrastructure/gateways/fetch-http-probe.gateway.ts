import { Injectable } from '@nestjs/common';
import type {
  IHttpProbeGateway,
  ProbeResult,
} from '../../domain/gateways/http-probe.gateway.interface';

const TIMEOUT_MS = 10_000;

/** 4xx·5xx 와 시간 초과, 연결 실패를 실패로 본다. 본문은 읽지 않는다. */
@Injectable()
export class FetchHttpProbeGateway implements IHttpProbeGateway {
  async probe(url: string): Promise<ProbeResult> {
    const started = Date.now();
    try {
      const response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { 'user-agent': 'kscold-control-uptime' },
      });
      await response.body?.cancel();
      const ok = response.status < 400;
      return {
        ok,
        statusCode: response.status,
        latencyMs: Date.now() - started,
        error: ok ? null : `HTTP ${response.status}`,
      };
    } catch (error) {
      const timedOut = error instanceof Error && error.name === 'TimeoutError';
      return {
        ok: false,
        statusCode: null,
        latencyMs: null,
        error: timedOut
          ? `${TIMEOUT_MS / 1000}초 안에 응답 없음`
          : (
              (error as { cause?: { code?: string } }).cause?.code ??
              (error instanceof Error ? error.message : 'unknown')
            ).slice(0, 200),
      };
    }
  }
}
