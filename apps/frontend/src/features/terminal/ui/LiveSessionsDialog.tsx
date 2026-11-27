import { useEffect, useState } from 'react';
import { Link2, TerminalSquare } from 'lucide-react';
import { Dialog } from '@/shared/ui';
import {
  terminalSessionsService,
  type LiveTerminalSession,
} from '../api/terminal-sessions.service';

function ago(iso: string | null): string {
  if (!iso) return '활동 기록 없음';
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (minutes < 1) return '방금 사용';
  if (minutes < 60) return `${minutes}분 전 사용`;
  const hours = Math.round(minutes / 60);
  return hours < 48
    ? `${hours}시간 전 사용`
    : `${Math.round(hours / 24)}일 전 사용`;
}

/**
 * 다른 기기에서 열어 둔 셸(돌고 있는 Claude·빌드 등)에 이 기기에서 다시 붙는다.
 * 고르면 새 탭이 그 세션으로 연결되고, 이전 출력이 복원된다.
 */
export function LiveSessionsDialog({
  open,
  openSessionIds,
  onClose,
  onPick,
}: {
  open: boolean;
  /** 이미 이 화면 탭에 붙어 있는 세션 */
  openSessionIds: string[];
  onClose: () => void;
  onPick: (session: LiveTerminalSession) => void;
}) {
  const [sessions, setSessions] = useState<LiveTerminalSession[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSessions(null);
    setError(null);
    terminalSessionsService
      .listLive()
      .then(setSessions)
      .catch((e: unknown) =>
        setError(
          e instanceof Error ? e.message : '세션을 불러오지 못했습니다.',
        ),
      );
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      closeOnBackdrop
      title="열린 세션에 이어 붙기"
      description="다른 기기에서 열어 둔 터미널을 여기서 이어서 씁니다."
      icon={<Link2 size={18} className="text-sky-300" />}
    >
      {error ? (
        <p className="text-sm text-red-300">{error}</p>
      ) : sessions === null ? (
        <p className="text-sm text-gray-400">불러오는 중…</p>
      ) : sessions.length === 0 ? (
        <p className="text-sm text-gray-400">
          살아 있는 터미널 세션이 없습니다.
        </p>
      ) : (
        <ul className="space-y-2">
          {sessions.map((session) => {
            const here = openSessionIds.includes(session.id);
            return (
              <li key={session.id}>
                <button
                  type="button"
                  onClick={() => onPick(session)}
                  className="flex w-full items-center gap-3 rounded-lg bg-gray-800/70 px-3 py-3 text-left hover:bg-gray-700"
                >
                  <TerminalSquare
                    size={18}
                    className="shrink-0 text-gray-400"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-white">
                      {session.title || '터미널'}
                    </span>
                    <span className="block text-xs text-gray-400">
                      {ago(session.lastActivityAt)} · {session.id.slice(0, 8)}
                    </span>
                  </span>
                  {here && (
                    <span className="shrink-0 text-xs text-sky-300">
                      이 화면에 열림
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Dialog>
  );
}
