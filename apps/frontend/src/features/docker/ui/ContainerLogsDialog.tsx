import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, ScrollText } from 'lucide-react';
import { Dialog, dialogButtonClass } from '@/shared/ui';
import { containerOpsService } from '../api/container-ops.service';

const LINE_OPTIONS = [100, 300, 1000] as const;

interface ContainerLogsDialogProps {
  open: boolean;
  dockerId: string;
  name: string;
  onClose: () => void;
}

/** 휴대폰에서도 바로 볼 수 있게 마지막 로그를 아래(최신)부터 보여 준다 */
export function ContainerLogsDialog({
  open,
  dockerId,
  name,
  onClose,
}: ContainerLogsDialogProps) {
  const [lines, setLines] = useState<number>(300);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setText(await containerOpsService.getLogs(dockerId, lines));
    } catch (e) {
      setError(e instanceof Error ? e.message : '로그를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [dockerId, lines]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [text]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      icon={<ScrollText size={18} className="text-sky-300" />}
      title={`${name} 로그`}
      description={`마지막 ${lines}줄`}
      footer={
        <div className="flex w-full flex-wrap items-center gap-2">
          {LINE_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setLines(option)}
              aria-pressed={lines === option}
              className={`rounded-lg px-3 py-2 text-xs ${
                lines === option
                  ? 'bg-sky-600 text-white'
                  : 'bg-gray-800 text-gray-300'
              }`}
            >
              {option}줄
            </button>
          ))}
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className={`ml-auto inline-flex items-center gap-1.5 ${dialogButtonClass('neutral')}`}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            새로고침
          </button>
        </div>
      }
    >
      {error ? (
        <p className="rounded-lg bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      ) : (
        <pre className="max-h-[60dvh] overflow-auto whitespace-pre-wrap rounded-lg bg-black/60 p-3 font-mono text-[11px] leading-4 text-gray-200 sm:text-xs">
          {loading && !text ? '불러오는 중…' : text || '로그가 없습니다.'}
          <div ref={bottomRef} />
        </pre>
      )}
    </Dialog>
  );
}
