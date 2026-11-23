import { useEffect, useRef } from 'react';

/**
 * 폼 아래쪽 오류 문장. 긴 대화상자에서는 화면 밖에 떠서 버튼이 안 눌린 것처럼 보이므로,
 * 문장이 바뀔 때마다 보이는 곳까지 스크롤한다.
 */
export function FormError({ message }: { message: string | null }) {
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (message)
      ref.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }, [message]);

  if (!message) return null;
  return (
    <p
      ref={ref}
      role="alert"
      className="whitespace-pre-line rounded-lg border border-red-900/60 bg-red-950/30 px-3 py-2 text-sm text-red-200"
    >
      {message}
    </p>
  );
}
