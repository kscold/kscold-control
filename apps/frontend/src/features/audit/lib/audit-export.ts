import { formatExportFilename } from '@/shared/lib/date-format';
import type { AuditExportPayload } from '../model/audit.types';

function escapeCsvCell(value: unknown) {
  const normalized =
    typeof value === 'string' ? value : JSON.stringify(value ?? '');
  return `"${normalized.replace(/"/g, '""')}"`;
}

function toCsv(payload: AuditExportPayload) {
  const header = [
    'id',
    'domain',
    'action',
    'summary',
    'actorEmail',
    'actorId',
    'targetType',
    'targetId',
    'createdAt',
    'metadata',
  ];
  const rows = payload.items.map((item) => [
    item.id,
    item.domain,
    item.action,
    item.summary,
    item.actorEmail ?? '',
    item.actorId ?? '',
    item.targetType ?? '',
    item.targetId ?? '',
    item.createdAt,
    JSON.stringify(item.metadata),
  ]);
  return [header, ...rows]
    .map((row) => row.map((value) => escapeCsvCell(value)).join(','))
    .join('\n');
}

/** 내보낸 감사 기록을 JSON 또는 CSV 파일로 내려받는다. */
export function downloadAuditExport(
  payload: AuditExportPayload,
  format: 'json' | 'csv',
) {
  const blob =
    format === 'json'
      ? new Blob([JSON.stringify(payload, null, 2)], {
          type: 'application/json',
        })
      : // 엑셀에서 한글이 깨지지 않게 BOM 을 붙인다.
        new Blob(['﻿', toCsv(payload)], { type: 'text/csv;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = formatExportFilename(payload.exportedAt, format);
  link.click();
  window.URL.revokeObjectURL(url);
}
