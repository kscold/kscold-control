import { useId } from 'react';
import { Download } from 'lucide-react';
import { useAuthStore } from '@/shared/model';
import { CopyButton } from './CopyButton';

const ACTION_CLASS =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 transition hover:bg-slate-800 hover:text-white';

function saveAsText(fileName: string, content: string) {
  const url = URL.createObjectURL(
    new Blob([content], { type: 'text/plain;charset=utf-8' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

interface RecoveryCodesPanelProps {
  codes: string[];
  saved: boolean;
  onSavedChange: (saved: boolean) => void;
}

export function RecoveryCodesPanel({
  codes,
  saved,
  onSavedChange,
}: RecoveryCodesPanelProps) {
  const checkboxId = useId();
  const email = useAuthStore((state) => state.user?.email);

  const download = () =>
    saveAsText(
      'kscold-control-recovery-codes.txt',
      [
        'kscold-control 복구 코드',
        ...(email ? [`계정: ${email}`] : []),
        `만든 시각: ${new Date().toLocaleString('ko-KR')}`,
        '각 코드는 한 번만 쓸 수 있습니다.',
        '',
        ...codes,
        '',
      ].join('\n'),
    );

  return (
    <div className="space-y-4">
      <p className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2.5 text-xs leading-5 text-amber-100">
        인증 앱을 쓸 수 없을 때 6자리 코드 대신 입력하는 코드입니다. 지금 한
        번만 보여 주고, 각 코드는 한 번만 쓸 수 있습니다.
      </p>

      <ul
        aria-label="복구 코드"
        className="grid grid-cols-1 gap-2 sm:grid-cols-2"
      >
        {codes.map((code) => (
          <li
            key={code}
            className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-center font-mono text-sm tracking-wider text-white"
          >
            {code}
          </li>
        ))}
      </ul>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <CopyButton
          value={codes.join('\n')}
          label="모두 복사"
          className={ACTION_CLASS}
        />
        <button type="button" onClick={download} className={ACTION_CLASS}>
          <Download size={15} />
          파일로 내려받기
        </button>
      </div>

      <label
        htmlFor={checkboxId}
        className="flex cursor-pointer items-start gap-2 text-sm text-slate-200"
      >
        <input
          id={checkboxId}
          type="checkbox"
          checked={saved}
          onChange={(event) => onSavedChange(event.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-amber-400"
        />
        안전한 곳에 저장했습니다
      </label>
    </div>
  );
}
