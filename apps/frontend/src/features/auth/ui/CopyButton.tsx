import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';

type CopyState = 'idle' | 'copied' | 'failed';

const LABEL: Record<CopyState, string> = {
  idle: '복사',
  copied: '복사됨',
  failed: '복사 실패',
};

export function CopyButton({
  value,
  label = LABEL.idle,
  className,
}: {
  value: string;
  label?: string;
  className: string;
}) {
  const [state, setState] = useState<CopyState>('idle');

  useEffect(() => {
    if (state === 'idle') return;
    const timer = window.setTimeout(() => setState('idle'), 2000);
    return () => window.clearTimeout(timer);
  }, [state]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setState('copied');
    } catch {
      setState('failed');
    }
  };

  return (
    <button type="button" onClick={() => void copy()} className={className}>
      {state === 'copied' ? <Check size={15} /> : <Copy size={15} />}
      {state === 'idle' ? label : LABEL[state]}
    </button>
  );
}
