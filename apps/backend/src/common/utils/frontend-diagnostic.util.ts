const kinds = [
  'render',
  'runtime',
  'unhandled-rejection',
  'resource',
  'upload',
];
const routes = [
  '/',
  '/login',
  '/pending',
  '/keys',
  '/terminal',
  '/docker',
  '/rbac',
  '/logs',
  '/nginx',
  '/network',
  '/topology',
  '/repository',
  '/backups',
  '/maintenance',
  '/audit',
  '/security',
];
const codes = [
  'unexpected',
  'integrity',
  'file-access',
  'aborted',
  'chunk-load',
  'unauthorized',
  'forbidden',
  'conflict',
  'payload-limit',
  'rate-limit',
  'validation',
  'server',
  'timeout',
  'network',
];
const errorTypes = [
  'Error',
  'TypeError',
  'RangeError',
  'ReferenceError',
  'SyntaxError',
  'DOMException',
  'ApiError',
];
const stages = ['selection', 'preflight', 'session', 'batch', 'finalize'];

function allowed(value: unknown, values: string[], fallback: string): string {
  return typeof value === 'string' && values.includes(value) ? value : fallback;
}

function integer(value: unknown, min: number, max: number): number | undefined {
  return typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= min &&
    value <= max
    ? value
    : undefined;
}

/** 브라우저는 신뢰 경계 밖임. 원문을 마스킹하지 않고 허용된 진단 필드만 새로 만듦. */
export function sanitizeFrontendDiagnostic(input: unknown) {
  const info =
    input && typeof input === 'object'
      ? (input as Record<string, unknown>)
      : {};
  return {
    kind: allowed(info.kind, kinds, 'legacy'),
    route: allowed(info.route, routes, 'unknown'),
    code: allowed(info.code, codes, 'unexpected'),
    errorType: allowed(info.errorType, errorTypes, 'Other'),
    stage: allowed(info.stage, stages, 'unknown'),
    batchIndex: integer(info.batchIndex, 0, 100_000),
    httpStatus: integer(info.httpStatus, 400, 599),
    release:
      typeof info.release === 'string' &&
      /^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(info.release)
        ? info.release
        : 'unknown',
  };
}
