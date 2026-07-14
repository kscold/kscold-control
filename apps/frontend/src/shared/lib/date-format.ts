/** 날짜/시간 포맷 유틸 */

/**
 * 감사 로그용 단축 포맷: "4월 17일 11:09:22"
 * ISO 파싱 실패 시 원본 문자열 그대로 반환
 */
export function formatAuditTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * 전체 날짜+시각 포맷: "2026. 04. 17. 11:09:22"
 * ISO 파싱 실패 시 빈 문자열 반환
 */
export function formatFullDateTime(value: string | Date): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
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
