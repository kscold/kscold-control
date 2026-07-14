import { ToolUse } from '../model/claude-chat.types';

const TOOL_LABELS: Record<string, { label: string; color: string }> = {
  Read: { label: 'Read', color: 'bg-green-900 text-green-300' },
  Edit: { label: 'Edit', color: 'bg-yellow-900 text-yellow-300' },
  Write: { label: 'Write', color: 'bg-orange-900 text-orange-300' },
  Bash: { label: 'Bash', color: 'bg-red-900 text-red-300' },
  Glob: { label: 'Glob', color: 'bg-blue-900 text-blue-300' },
  Grep: { label: 'Grep', color: 'bg-purple-900 text-purple-300' },
  WebFetch: { label: 'Web', color: 'bg-cyan-900 text-cyan-300' },
};

function getToolInfo(tool: string) {
  return (
    TOOL_LABELS[tool] || { label: tool, color: 'bg-gray-700 text-gray-300' }
  );
}

interface ToolIndicatorProps {
  tools: ToolUse[];
}

export function ToolIndicator({ tools }: ToolIndicatorProps) {
  if (!tools || tools.length === 0) return null;

  return (
    <div className="mb-3 space-y-2 rounded-2xl border border-white/8 bg-slate-950/70 p-3">
      {tools.map((t, i) => {
        const info = getToolInfo(t.tool);
        return (
          <div
            key={`${t.tool}-${t.input}-${i}`}
            className="flex items-start justify-between gap-3 rounded-2xl border border-white/6 bg-white/5 px-3 py-2"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${info.color}`}
                >
                  {t.status === 'start' && (
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                  )}
                  {info.label}
                </span>
                <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  {t.status === 'end' ? 'completed' : 'running'}
                </span>
              </div>
              {t.input && (
                <p className="mt-1 truncate font-mono text-xs text-slate-400">
                  {t.input}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
