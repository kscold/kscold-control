const MAX_STRING_LENGTH = 2_048;
const MAX_ARRAY_ITEMS = 25;
const MAX_OBJECT_KEYS = 50;
const MAX_DEPTH = 6;

const UPLOAD_SESSION_CREATE_PATH =
  /\/repository\/projects\/[^/]+\/upload-sessions\/?$/;
const UPLOAD_SESSION_BATCH_PATH =
  /\/repository\/projects\/[^/]+\/upload-sessions\/[^/]+\/batches\/\d+\/?$/;

function isSensitiveQueryParameter(key: string): boolean {
  const normalized = key.replace(/[-_]/g, '').toLowerCase();
  return (
    normalized.includes('password') ||
    normalized.includes('secret') ||
    normalized.includes('token') ||
    normalized === 'authorization' ||
    normalized === 'apikey' ||
    normalized === 'signature'
  );
}

function isSensitiveField(key: string): boolean {
  const normalized = key.replace(/[-_]/g, '').toLowerCase();
  return (
    normalized.includes('password') ||
    normalized.includes('secret') ||
    normalized.endsWith('token') ||
    normalized === 'authorization' ||
    normalized === 'apikey' ||
    normalized === 'privatekey' ||
    normalized === 'credential' ||
    normalized === 'cookie' ||
    normalized === 'setcookie' ||
    normalized === 'envfile' ||
    normalized === 'encryptedpayload' ||
    normalized === 'authtag' ||
    normalized === 'iv'
  );
}

function truncateString(value: string): string {
  if (value.length <= MAX_STRING_LENGTH) return value;
  return `${value.slice(0, MAX_STRING_LENGTH)}...[${value.length - MAX_STRING_LENGTH} chars omitted]`;
}

function sanitizeValue(
  value: unknown,
  seen: WeakSet<object>,
  depth: number,
): unknown {
  if (typeof value === 'string') return truncateString(value);
  if (!value || typeof value !== 'object') return value;
  if (Buffer.isBuffer(value)) return `[binary ${value.length} bytes omitted]`;
  if (depth >= MAX_DEPTH) return '[maximum log depth reached]';
  if (seen.has(value)) return '[circular reference omitted]';
  seen.add(value);

  if (Array.isArray(value)) {
    const items = value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => sanitizeValue(item, seen, depth + 1));
    if (value.length > MAX_ARRAY_ITEMS) {
      items.push(`[${value.length - MAX_ARRAY_ITEMS} items omitted]`);
    }
    return items;
  }

  const entries = Object.entries(value);
  const sanitized: Record<string, unknown> = {};
  for (const [key, nestedValue] of entries.slice(0, MAX_OBJECT_KEYS)) {
    sanitized[key] = isSensitiveField(key)
      ? '***REDACTED***'
      : sanitizeValue(nestedValue, seen, depth + 1);
  }
  if (entries.length > MAX_OBJECT_KEYS) {
    sanitized.__omittedKeys = entries.length - MAX_OBJECT_KEYS;
  }
  return sanitized;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function summarizeUploadSession(body: unknown): Record<string, unknown> {
  const record = asRecord(body);
  const batches = Array.isArray(record.batches) ? record.batches : [];

  return {
    protocolVersion: record.protocolVersion,
    replace: record.replace,
    totalFiles: record.totalFiles,
    totalBytes: record.totalBytes,
    filteredCount: record.filteredCount,
    batchCount: batches.length,
    manifestDigest: record.manifestDigest,
    manifestFiles: '[file paths and hashes omitted]',
  };
}

function summarizeUploadBatch(body: unknown): Record<string, unknown> {
  const record = asRecord(body);
  const relativePaths = record.relativePaths;

  return {
    multipart: true,
    relativePathCount: Array.isArray(relativePaths)
      ? relativePaths.length
      : relativePaths
        ? 1
        : 0,
    relativePaths: '[file paths omitted]',
    files: '[binary payload omitted]',
  };
}

export function sanitizeHttpRequestBody(
  body: unknown,
  method: string,
  originalUrl: string,
): unknown {
  const path = originalUrl.split('?', 1)[0];
  if (
    method.toUpperCase() === 'POST' &&
    UPLOAD_SESSION_CREATE_PATH.test(path)
  ) {
    return summarizeUploadSession(body);
  }
  if (method.toUpperCase() === 'POST' && UPLOAD_SESSION_BATCH_PATH.test(path)) {
    return summarizeUploadBatch(body);
  }

  return sanitizeValue(body, new WeakSet<object>(), 0);
}

export function sanitizeHttpRequestUrl(originalUrl: string): string {
  try {
    const url = new URL(originalUrl, 'http://localhost');
    for (const key of [...url.searchParams.keys()]) {
      if (isSensitiveQueryParameter(key)) {
        url.searchParams.set(key, '***REDACTED***');
      }
    }
    return `${url.pathname}${url.search}`;
  } catch {
    return originalUrl.replace(
      /([?&][^=&]*(?:password|secret|token|authorization|api[_-]?key|signature)[^=&]*=)[^&]*/gi,
      '$1***REDACTED***',
    );
  }
}
