import { useState, type FormEvent } from 'react';
import { Activity } from 'lucide-react';
import { Dialog, dialogButtonClass, dialogInputClass } from '@/shared/ui';
import { uptimeService } from '../api/uptime.service';

const INTERVALS = [30, 60, 300] as const;

export function AddMonitorDialog({
  open,
  onClose,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('https://');
  const [intervalSeconds, setIntervalSeconds] = useState<number>(60);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await uptimeService.create({ name, url, intervalSeconds });
      setName('');
      setUrl('https://');
      onAdded();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '추가하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      busy={busy}
      title="감시할 주소 추가"
      description="주소를 주기적으로 열어 보고, 두 번 연속 실패하면 끊김으로 알립니다."
      icon={<Activity size={18} className="text-emerald-300" />}
      onSubmit={submit}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className={dialogButtonClass('neutral')}
          >
            취소
          </button>
          <button
            type="submit"
            disabled={busy}
            className={dialogButtonClass('emerald')}
          >
            {busy ? '확인 중…' : '추가'}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <label className="block text-xs text-gray-400">
          이름
          <input
            required
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 블로그"
            className={`mt-1 ${dialogInputClass('emerald')}`}
          />
        </label>
        <label className="block text-xs text-gray-400">
          주소
          <input
            required
            type="url"
            inputMode="url"
            autoCapitalize="off"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className={`mt-1 ${dialogInputClass('emerald')}`}
          />
        </label>
        <div className="text-xs text-gray-400">
          검사 간격
          <div className="mt-1 grid grid-cols-3 gap-2">
            {INTERVALS.map((seconds) => (
              <button
                key={seconds}
                type="button"
                aria-pressed={intervalSeconds === seconds}
                onClick={() => setIntervalSeconds(seconds)}
                className={`rounded-lg py-2 text-sm ${
                  intervalSeconds === seconds
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-800 text-gray-300'
                }`}
              >
                {seconds < 60 ? `${seconds}초` : `${seconds / 60}분`}
              </button>
            ))}
          </div>
        </div>
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
      </div>
    </Dialog>
  );
}
