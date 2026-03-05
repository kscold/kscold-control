import { ToolUse } from '../lib/claude-chat.types';

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
  return TOOL_LABELS[tool] || { label: tool, color: 'bg-gray-700 text-gray-300' };
}

interface ToolIndicatorProps {
  tools: ToolUse[];
}

export function ToolIndicator({ tools }: ToolIndicatorProps) {
  if (!tools || tools.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5 mb-1">
      {tools.map((t, i) => {
        const info = getToolInfo(t.tool);
        return (
          <span
            key={i}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${info.color}`}
          >
            {t.status === 'start' && (
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
            )}
            {info.label}
            {t.input && (
              <span className="opacity-60 truncate max-w-[120px]">{t.input}</span>
            )}
          </span>
        );
      })}
    </div>
  );
}
