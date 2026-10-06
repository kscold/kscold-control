import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';

export interface ScopeItem {
  id: string;
  label: string;
  /** 이름 옆에 작게 붙는 보조 설명 (환경 이름 등) */
  hint?: string;
}

/** 색 조합. Tailwind 가 클래스를 찾을 수 있도록 문자열을 통째로 적어 둔다. */
const TONES = {
  cyan: {
    box: 'border-cyan-400/20',
    title: 'text-cyan-100',
    editButton: 'border-cyan-400/30 text-cyan-100 hover:bg-cyan-400/10',
    chip: 'border-cyan-400/20 bg-cyan-400/10 text-cyan-100',
    checkbox: 'accent-cyan-400',
    saveButton: 'bg-cyan-500 hover:bg-cyan-400',
  },
  teal: {
    box: 'border-teal-400/20',
    title: 'text-teal-100',
    editButton: 'border-teal-400/30 text-teal-100 hover:bg-teal-400/10',
    chip: 'border-teal-400/20 bg-teal-400/10 text-teal-100',
    checkbox: 'accent-teal-400',
    saveButton: 'bg-teal-500 hover:bg-teal-400',
  },
} as const;

interface TargetScopeSectionProps {
  tone: keyof typeof TONES;
  icon: LucideIcon;
  title: string;
  /** 고를 수 있는 전체 대상 */
  items: ScopeItem[];
  /** 지금 배정된 대상 id */
  assignedIds: string[];
  /** 배정 없이 전체를 쓰는 사용자면 그 사실을 알리는 문구. 있으면 편집할 수 없다. */
  fullAccessLabel?: string;
  emptyLabel: string;
  editLabel: string;
  saveLabel: string;
  /** 저장에 성공하면 true 를 돌려준다. */
  onSave: (ids: string[]) => Promise<boolean>;
}

/**
 * 사용자 한 명에게 배정된 대상 범위를 보여주고 고치는 영역.
 * 운영 키 범위와 백업 열람 범위가 같은 모양이라 함께 쓴다.
 */
export function TargetScopeSection({
  tone,
  icon: Icon,
  title,
  items,
  assignedIds,
  fullAccessLabel,
  emptyLabel,
  editLabel,
  saveLabel,
  onSave,
}: TargetScopeSectionProps) {
  const [editing, setEditing] = useState(false);
  const [draftIds, setDraftIds] = useState<string[]>([]);
  const colors = TONES[tone];
  const assignedItems = items.filter((item) => assignedIds.includes(item.id));

  const handleSave = async () => {
    if (await onSave(draftIds)) setEditing(false);
  };

  return (
    <div
      className={`mt-3 rounded-lg border bg-slate-950/35 p-2.5 ${colors.box}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className={`inline-flex items-center gap-1.5 text-xs font-semibold ${colors.title}`}
        >
          <Icon size={14} /> {title}
        </span>
        {fullAccessLabel ? (
          <span className="text-[11px] text-slate-400">{fullAccessLabel}</span>
        ) : (
          <button
            type="button"
            onClick={() => {
              setEditing(true);
              setDraftIds(assignedIds);
            }}
            className={`rounded border px-2 py-1 text-[11px] font-semibold ${colors.editButton}`}
          >
            {editLabel}
          </button>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {assignedItems.length > 0 ? (
          assignedItems.map((item) => (
            <span
              key={item.id}
              className={`rounded-md border px-2 py-1 text-[11px] ${colors.chip}`}
            >
              {item.label}
            </span>
          ))
        ) : (
          <span className="text-[11px] text-amber-300">{emptyLabel}</span>
        )}
      </div>
      {editing && (
        <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
          {items.map((item) => (
            <label
              key={item.id}
              className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-white/10 bg-slate-900/70 px-2.5 py-2 text-xs text-slate-200"
            >
              <span>
                {item.label}
                {item.hint && (
                  <span className="ml-2 text-[10px] uppercase text-slate-500">
                    {item.hint}
                  </span>
                )}
              </span>
              <input
                type="checkbox"
                checked={draftIds.includes(item.id)}
                onChange={(event) =>
                  setDraftIds((current) =>
                    event.target.checked
                      ? [...current, item.id]
                      : current.filter((id) => id !== item.id),
                  )
                }
                className={`h-4 w-4 ${colors.checkbox}`}
              />
            </label>
          ))}
          {items.length === 0 && (
            <p className="text-[11px] text-slate-500">
              고를 수 있는 대상이 없습니다.
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handleSave()}
              className={`rounded px-3 py-1.5 text-xs font-bold text-slate-950 ${colors.saveButton}`}
            >
              {saveLabel}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded border border-white/15 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5"
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
