/** 감사 이벤트 metadata의 before/after diff를 계산하는 유틸 */

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function flattenRecord(
  value: Record<string, unknown>,
  prefix = '',
  output = new Map<string, unknown>(),
): Map<string, unknown> {
  Object.entries(value).forEach(([key, nestedValue]) => {
    const nextPath = prefix ? `${prefix}.${key}` : key;
    if (isRecord(nestedValue) && Object.keys(nestedValue).length > 0) {
      flattenRecord(nestedValue, nextPath, output);
      return;
    }
    output.set(nextPath, nestedValue);
  });
  return output;
}

export interface DiffEntry {
  changeType: 'added' | 'removed' | 'changed';
  path: string;
  beforeValue: unknown;
  afterValue: unknown;
}

export function buildDiffEntries(metadata: Record<string, unknown>): DiffEntry[] {
  const before = isRecord(metadata.before) ? metadata.before : null;
  const after = isRecord(metadata.after) ? metadata.after : null;

  if (!before && !after) return [];

  const beforeMap = before ? flattenRecord(before) : new Map<string, unknown>();
  const afterMap = after ? flattenRecord(after) : new Map<string, unknown>();
  const paths = Array.from(new Set([...beforeMap.keys(), ...afterMap.keys()])).sort((a, b) =>
    a.localeCompare(b),
  );

  return paths.flatMap((p) => {
    const beforeValue = beforeMap.get(p);
    const afterValue = afterMap.get(p);
    if (JSON.stringify(beforeValue) === JSON.stringify(afterValue)) return [];

    const changeType = !beforeMap.has(p) ? 'added' : !afterMap.has(p) ? 'removed' : 'changed';
    return [{ changeType, path: p, beforeValue, afterValue }];
  });
}

export function buildDiffPreview(metadata: Record<string, unknown>): string | null {
  const entries = buildDiffEntries(metadata);
  if (entries.length === 0) return null;

  const preview = entries.slice(0, 3).map((e) => e.path).join(', ');
  const remainder = entries.length > 3 ? ` +${entries.length - 3}` : '';
  return `${entries.length} changed · ${preview}${remainder}`;
}
