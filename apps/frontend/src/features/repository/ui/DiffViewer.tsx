import { useMemo } from 'react';
import { diffLines, type Change } from 'diff';

interface DiffViewerProps {
  beforeText: string;
  afterText: string;
  beforeMissing: boolean;
  afterMissing?: boolean;
}

type DiffRow =
  | { kind: 'context'; beforeNum: number; afterNum: number; text: string }
  | { kind: 'add'; afterNum: number; text: string }
  | { kind: 'del'; beforeNum: number; text: string };

export function DiffViewer({
  beforeText,
  afterText,
  beforeMissing,
  afterMissing = false,
}: DiffViewerProps) {
  const rows = useMemo(
    () => buildDiffRows(beforeText, afterText),
    [beforeText, afterText],
  );

  const stats = useMemo(() => {
    let added = 0;
    let removed = 0;
    for (const row of rows) {
      if (row.kind === 'add') added++;
      else if (row.kind === 'del') removed++;
    }
    return { added, removed };
  }, [rows]);

  if (beforeMissing) {
    return (
      <div className="flex h-full flex-col">
        <DiffHeader added={stats.added} removed={0} note="이전 버전에 없던 새 파일" />
        <div className="flex-1 overflow-auto bg-[#0d1117]">
          <div className="flex font-mono text-xs leading-5">
            <LineGutter count={afterText.split('\n').length} tone="add" />
            <pre className="flex-1 overflow-x-auto py-3">
              {afterText.split('\n').map((line, i) => (
                <div
                  key={i}
                  className="block bg-emerald-500/10 px-4 text-emerald-200"
                >
                  <span className="select-none pr-2 text-emerald-400">+</span>
                  {line || '​'}
                </div>
              ))}
            </pre>
          </div>
        </div>
      </div>
    );
  }

  if (afterMissing) {
    return (
      <div className="flex h-full flex-col">
        <DiffHeader added={0} removed={stats.removed} note="현재 버전에서 삭제됨" />
        <div className="flex-1 overflow-auto bg-[#0d1117]">
          <div className="flex font-mono text-xs leading-5">
            <LineGutter count={beforeText.split('\n').length} tone="del" />
            <pre className="flex-1 overflow-x-auto py-3">
              {beforeText.split('\n').map((line, i) => (
                <div key={i} className="block bg-rose-500/10 px-4 text-rose-200">
                  <span className="select-none pr-2 text-rose-400">-</span>
                  {line || '​'}
                </div>
              ))}
            </pre>
          </div>
        </div>
      </div>
    );
  }

  if (rows.length === 0 || (stats.added === 0 && stats.removed === 0)) {
    return (
      <div className="flex h-full flex-col">
        <DiffHeader added={0} removed={0} note="변경 없음 (바이트 동일)" />
        <div className="flex flex-1 items-center justify-center bg-[#0d1117] text-sm text-gray-500">
          이전 버전과 내용이 같습니다
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <DiffHeader added={stats.added} removed={stats.removed} />
      <div className="flex-1 overflow-auto bg-[#0d1117]">
        <pre className="font-mono text-xs leading-5">
          {rows.map((row, idx) => (
            <DiffRowLine key={idx} row={row} />
          ))}
        </pre>
      </div>
    </div>
  );
}

function DiffHeader({
  added,
  removed,
  note,
}: {
  added: number;
  removed: number;
  note?: string;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-gray-800 bg-gray-900/60 px-4 py-2 text-xs">
      <span className="whitespace-nowrap rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-emerald-300">
        +{added}
      </span>
      <span className="whitespace-nowrap rounded border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-rose-300">
        −{removed}
      </span>
      {note && <span className="truncate text-gray-500">{note}</span>}
    </div>
  );
}

function LineGutter({
  count,
  tone,
}: {
  count: number;
  tone: 'add' | 'del';
}) {
  const color = tone === 'add' ? 'text-emerald-400/80' : 'text-rose-400/80';
  return (
    <div
      className={`select-none border-r border-gray-800/80 bg-gray-900/40 px-3 py-3 text-right ${color}`}
    >
      {Array.from({ length: count }, (_, i) => (
        <div key={i}>{i + 1}</div>
      ))}
    </div>
  );
}

function DiffRowLine({ row }: { row: DiffRow }) {
  if (row.kind === 'context') {
    return (
      <div className="grid grid-cols-[3em_3em_1ch_1fr] text-gray-400">
        <span className="select-none pr-2 text-right text-gray-600">
          {row.beforeNum}
        </span>
        <span className="select-none pr-2 text-right text-gray-600">
          {row.afterNum}
        </span>
        <span className="select-none text-gray-700"> </span>
        <span className="pr-4 text-gray-400">{row.text || '​'}</span>
      </div>
    );
  }
  if (row.kind === 'add') {
    return (
      <div className="grid grid-cols-[3em_3em_1ch_1fr] bg-emerald-500/10 text-emerald-200">
        <span className="select-none pr-2 text-right text-emerald-500/70"></span>
        <span className="select-none pr-2 text-right text-emerald-400">
          {row.afterNum}
        </span>
        <span className="select-none text-emerald-400">+</span>
        <span className="pr-4">{row.text || '​'}</span>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-[3em_3em_1ch_1fr] bg-rose-500/10 text-rose-200">
      <span className="select-none pr-2 text-right text-rose-400">
        {row.beforeNum}
      </span>
      <span className="select-none pr-2 text-right text-rose-500/70"></span>
      <span className="select-none text-rose-400">−</span>
      <span className="pr-4">{row.text || '​'}</span>
    </div>
  );
}

function buildDiffRows(before: string, after: string): DiffRow[] {
  const changes: Change[] = diffLines(before, after);
  const rows: DiffRow[] = [];
  let beforeNum = 0;
  let afterNum = 0;

  for (const change of changes) {
    const lines = stripTrailingNewline(change.value).split('\n');
    for (const line of lines) {
      if (change.added) {
        afterNum++;
        rows.push({ kind: 'add', afterNum, text: line });
      } else if (change.removed) {
        beforeNum++;
        rows.push({ kind: 'del', beforeNum, text: line });
      } else {
        beforeNum++;
        afterNum++;
        rows.push({ kind: 'context', beforeNum, afterNum, text: line });
      }
    }
  }
  return rows;
}

function stripTrailingNewline(value: string): string {
  return value.endsWith('\n') ? value.slice(0, -1) : value;
}
