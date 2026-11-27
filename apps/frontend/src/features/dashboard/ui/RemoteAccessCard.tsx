import { Globe } from 'lucide-react';
import { useRemoteAccess } from '../model/useRemoteAccess';
import type { RemoteAccessPath } from '../model/dashboard.types';

const STATE_STYLE: Record<
  RemoteAccessPath['state'],
  { dot: string; text: string; label: string }
> = {
  ok: { dot: 'bg-green-400', text: 'text-green-300', label: '정상' },
  down: { dot: 'bg-red-400', text: 'text-red-300', label: '끊김' },
  unknown: { dot: 'bg-gray-500', text: 'text-gray-400', label: '확인 못 함' },
};

/** 밖(폰·해외)에서 이 서버로 들어오는 길이 살아 있는지 */
export function RemoteAccessCard() {
  const { paths, error } = useRemoteAccess();

  return (
    <section className="mb-4 rounded-xl border border-gray-800 bg-gray-900 p-3 sm:mb-5 sm:p-5">
      <div className="mb-2 flex items-center gap-2">
        <Globe size={18} className="text-cyan-400" />
        <h3 className="text-sm font-semibold text-white">원격 접속</h3>
      </div>
      {error ? (
        <p className="text-xs text-red-300">상태를 불러오지 못했습니다.</p>
      ) : !paths ? (
        <p className="text-xs text-gray-500">확인 중…</p>
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {paths.map((path) => {
            const style = STATE_STYLE[path.state];
            return (
              <li
                key={path.id}
                className="flex min-w-0 items-start gap-2 rounded-lg bg-gray-950/60 px-3 py-2"
              >
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${style.dot}`}
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="text-sm text-gray-100">
                    {path.label}{' '}
                    <span className={`text-xs ${style.text}`}>
                      {style.label}
                    </span>
                  </p>
                  {path.detail ? (
                    <p className="truncate text-xs text-gray-500">
                      {path.detail}
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
