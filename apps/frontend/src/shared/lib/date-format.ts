/** 날짜/시간 포맷 유틸 */

const SHORT_DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
};

const AUDIT_TIMESTAMP_OPTIONS: Intl.DateTimeFormatOptions = {
  ...SHORT_DATE_TIME_OPTIONS,
  second: '2-digit',
};

const FULL_DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
};

/**
 * 감사 로그용 단축 포맷: "4월 17일 11:09:22" (초 포함)
 * ISO 파싱 실패 시 원본 문자열 그대로 반환
 */
export function formatAuditTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('ko-KR', AUDIT_TIMESTAMP_OPTIONS);
}

/**
 * 목록/배지용 단축 포맷: "4월 17일 11:09" (초 없음)
 * 값이 없으면 `fallback`, ISO 파싱 실패 시 원본 문자열 그대로 반환
 */
export function formatShortDateTime(
  value: string | Date | null | undefined,
  fallback = '',
): string {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return typeof value === 'string' ? value : fallback;
  }
  return parsed.toLocaleString('ko-KR', SHORT_DATE_TIME_OPTIONS);
}

/**
 * 전체 날짜+시각 포맷: "2026. 04. 17. 오전 11:09:22"
 * 값이 없거나 ISO 파싱 실패 시 `fallback` 반환
 */
export function formatFullDateTime(
  value: string | Date | null | undefined,
  fallback = '',
): string {
  if (!value) return fallback;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  return d.toLocaleString('ko-KR', FULL_DATE_TIME_OPTIONS);
}

/**
 * export 파일명용: "audit-export-2026-04-17T11-09-22Z.json"
 * ISO 파싱 실패 시 fallback 파일명 반환
 */
export function formatExportFilename(
  value: string,
  extension = 'json',
): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return `audit-export.${extension}`;
  const ts = parsed
    .toISOString()
    .replace(/:/g, '-')
    .replace(/\.\d{3}Z$/, 'Z');
  return `audit-export-${ts}.${extension}`;
}
