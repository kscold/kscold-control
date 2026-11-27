export interface ProbeResult {
  ok: boolean;
  statusCode: number | null;
  latencyMs: number | null;
  error: string | null;
}

export interface IHttpProbeGateway {
  probe(url: string): Promise<ProbeResult>;
}

export const HTTP_PROBE_GATEWAY = Symbol('HTTP_PROBE_GATEWAY');
