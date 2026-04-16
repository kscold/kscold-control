import type { WorkspaceFileReference } from './terminal.types';

const FILE_REFERENCE_LIMIT = 12;
const FILE_REFERENCE_PATTERN =
  /(?:^|[\s("'`])((?:\/|\.{1,2}\/)?(?:[\w@.-]+\/)+[\w@.-]+\.[A-Za-z0-9_-]+)(?::(\d+))?(?::\d+)?/g;

function isLikelyFilePath(value: string): boolean {
  if (!value) return false;
  if (value.startsWith('http://') || value.startsWith('https://')) return false;
  if (value.includes('://')) return false;
  if (!value.includes('.')) return false;
  return true;
}

export function extractWorkspaceFileReferences(
  content: string,
): WorkspaceFileReference[] {
  const references: WorkspaceFileReference[] = [];
  const seen = new Set<string>();

  for (const match of content.matchAll(FILE_REFERENCE_PATTERN)) {
    const rawPath = match[1]?.trim();
    if (!rawPath || !isLikelyFilePath(rawPath)) {
      continue;
    }

    const normalizedPath = rawPath.replace(/[),.;]+$/, '');
    const line = match[2] ? Number(match[2]) : null;
    const key = `${normalizedPath}:${line ?? ''}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    references.push({
      path: normalizedPath,
      line: Number.isFinite(line) ? line : null,
      absolute: normalizedPath.startsWith('/'),
    });

    if (references.length >= FILE_REFERENCE_LIMIT) {
      break;
    }
  }

  return references;
}

export function mergeWorkspaceFileReferences(
  previous: WorkspaceFileReference[],
  next: WorkspaceFileReference[],
): WorkspaceFileReference[] {
  const merged = [...next, ...previous];
  const deduped: WorkspaceFileReference[] = [];
  const seen = new Set<string>();

  for (const item of merged) {
    const key = `${item.path}:${item.line ?? ''}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(item);
    if (deduped.length >= FILE_REFERENCE_LIMIT) {
      break;
    }
  }

  return deduped;
}

export function getWorkspaceFileDisplayPath(
  filePath: string,
  workingDirectory: string | null,
): string {
  if (!workingDirectory || !filePath.startsWith(workingDirectory)) {
    return filePath;
  }

  const relativePath = filePath
    .slice(workingDirectory.length)
    .replace(/^\/+/, '');
  return relativePath || '.';
}

export function getLineOffset(content: string, lineNumber: number): number {
  if (lineNumber <= 1) {
    return 0;
  }

  const lines = content.split('\n');
  let offset = 0;
  for (let index = 0; index < lines.length; index += 1) {
    if (index + 1 >= lineNumber) {
      break;
    }
    offset += lines[index].length + 1;
  }
  return offset;
}
