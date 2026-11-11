import { useId, useMemo, type RefObject } from 'react';
import { encodeQR } from 'qr';
import type { MfaEnrollmentSetup } from '@/shared/model';
import { CopyButton } from './CopyButton';
import { OtpInput } from './OtpInput';

function qrPath(text: string) {
  const modules = encodeQR(text, 'raw', { ecc: 'medium', border: 2 });
  let path = '';
  modules.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (!row[x]) {
        x += 1;
        continue;
      }
      const start = x;
      while (x < row.length && row[x]) x += 1;
      path += `M${start} ${y}h${x - start}v1h-${x - start}z`;
    }
  });
  return { path, size: modules.length };
}

function QrCode({ text }: { text: string }) {
  const { path, size } = useMemo(() => qrPath(text), [text]);
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label="인증 앱에 등록할 QR 코드"
      shapeRendering="crispEdges"
      className="block h-full w-full"
    >
      <path d={path} fill="#000" />
    </svg>
  );
}

interface MfaSetupPanelProps {
  enrollment: MfaEnrollmentSetup;
  code: string;
  onCodeChange: (code: string) => void;
  inputClassName: string;
  inputRef?: RefObject<HTMLInputElement>;
}

export function MfaSetupPanel({
  enrollment,
  code,
  onCodeChange,
  inputClassName,
  inputRef,
}: MfaSetupPanelProps) {
  const codeId = useId();
  const groupedSecret = enrollment.secret.match(/.{1,4}/g)?.join(' ') ?? '';

  return (
    <div className="space-y-4">
      <div className="mx-auto w-44 rounded-2xl bg-white p-2">
        <QrCode text={enrollment.otpauthUri} />
      </div>

      <div>
        <p className="mb-1 text-xs leading-5 text-slate-400">
          QR 코드를 찍을 수 없으면 이 키를 인증 앱에 직접 입력하세요.
        </p>
        <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2">
          <code
            aria-label="설정 키"
            className="min-w-0 flex-1 break-words font-mono text-sm tracking-wide text-amber-200"
          >
            {groupedSecret}
          </code>
          <CopyButton
            value={enrollment.secret}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 hover:text-white"
          />
        </div>
      </div>

      <div>
        <label htmlFor={codeId} className="mb-1 block text-sm text-slate-400">
          앱에 표시된 6자리 코드
        </label>
        <OtpInput
          id={codeId}
          value={code}
          onChange={onCodeChange}
          className={inputClassName}
          inputRef={inputRef}
        />
      </div>
    </div>
  );
}
