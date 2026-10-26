import { ApiError } from '../api/api-error';

export type DiagnosticKind =
  'render' | 'runtime' | 'unhandled-rejection' | 'resource' | 'upload';
export type UploadStage =
  'selection' | 'preflight' | 'session' | 'batch' | 'finalize';
export interface DiagnosticContext {
  kind?: DiagnosticKind;
  stage?: UploadStage;
  batchIndex?: number;
}

const routes = new Set([
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
]);
const kinds = new Set([
  'render',
  'runtime',
  'unhandled-rejection',
  'resource',
  'upload',
]);
const stages = new Set([
  'selection',
  'preflight',
  'session',
  'batch',
  'finalize',
]);
const errorTypes = new Set([
  'Error',
  'TypeError',
  'RangeError',
  'ReferenceError',
  'SyntaxError',
  'DOMException',
  'ApiError',
]);

export function frontendDiagnostic(
  error: unknown,
  context: DiagnosticContext = {},
) {
  const isError = error instanceof Error || error instanceof DOMException;
  const name = isError ? error.name : '';
  const message = isError ? error.message : '';
  const status = error instanceof ApiError ? error.status : undefined;
  let code = 'unexpected';
  if (name === 'RepositoryUploadIntegrityError') code = 'integrity';
  else if (
    [
      'NotReadableError',
      'NotFoundError',
      'NotAllowedError',
      'SecurityError',
    ].includes(name)
  )
    code = 'file-access';
  else if (
    name === 'AbortError' ||
    (error instanceof ApiError && error.code === 'ERR_CANCELED')
  )
    code = 'aborted';
  else if (
    /Failed to fetch dynamically imported module|Importing a module script failed|Unable to preload CSS/.test(
      message,
    )
  )
    code = 'chunk-load';
  else if (status === 401) code = 'unauthorized';
  else if (status === 403) code = 'forbidden';
  else if (status === 409) code = 'conflict';
  else if (status === 413) code = 'payload-limit';
  else if (status === 429) code = 'rate-limit';
  else if (status === 400 || status === 422) code = 'validation';
  else if (status && status >= 500) code = 'server';
  else if (error instanceof ApiError)
    code = ['ECONNABORTED', 'ETIMEDOUT'].includes(error.code ?? '')
      ? 'timeout'
      : 'network';

  // 원문 메시지·스택·URL·파일명은 필터링해서 보내지 않고 처음부터 포함하지 않음.
  return {
    kind: kinds.has(context.kind ?? '') ? context.kind : 'runtime',
    route: routes.has(window.location.pathname)
      ? window.location.pathname
      : 'unknown',
    code,
    errorType: errorTypes.has(name) ? name : 'Other',
    stage: stages.has(context.stage ?? '') ? context.stage : undefined,
    batchIndex:
      Number.isInteger(context.batchIndex) &&
      context.batchIndex! >= 0 &&
      context.batchIndex! <= 100_000
        ? context.batchIndex
        : undefined,
    httpStatus:
      Number.isInteger(status) && status! >= 400 && status! <= 599
        ? status
        : undefined,
    release: import.meta.env.VITE_APP_VERSION,
  };
}
