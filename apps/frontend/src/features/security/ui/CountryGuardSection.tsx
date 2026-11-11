import { useState } from 'react';
import { Globe2, Loader2, Plus, X } from 'lucide-react';
import type { SshCountryGuard } from '../model/security.types';
import { smallButton } from '../model/paging';

type Patch = Partial<Pick<SshCountryGuard, 'enabled' | 'allowedCountries'>>;

function countryName(code: string, known?: string | null): string {
  if (known) return known;
  try {
    return new Intl.DisplayNames(['ko'], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

const STATE_TEXT: Record<SshCountryGuard['state'], string> = {
  on: '켜짐',
  'no-geo': '쉬는 중',
  off: '꺼짐',
};

/** 허용 국가 밖 SSH 차단 — 허용 국가 목록, 켜고 끄기, 다시 허용한 나라의 남은 차단 풀기 */
export function CountryGuardSection({
  guard,
  canManage,
  disabled,
  confirm,
  onUpdate,
  onUnblockCountry,
}: {
  guard: SshCountryGuard;
  canManage: boolean;
  disabled: boolean;
  confirm: (message: string, key: string, fn: () => Promise<unknown>) => void;
  onUpdate: (patch: Patch) => Promise<unknown>;
  onUnblockCountry: (country: string) => Promise<unknown>;
}) {
  const [code, setCode] = useState('');
  const allowed = guard.allowedCountries;
  const leftovers = guard.blockedByCountry.filter((b) =>
    allowed.includes(b.country),
  );
  const names = new Map(
    guard.blockedByCountry.map((b) => [b.country, b.countryName]),
  );
  const list = allowed.map((c) => `${c}(${countryName(c, names.get(c))})`);

  return (
    <div className="mb-4 rounded-xl border border-gray-800 bg-gray-900/40 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-medium text-white">
          <Globe2 size={14} className="text-sky-300" />
          허용 국가 밖 SSH 차단 · {STATE_TEXT[guard.state]}
        </p>
        {canManage && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => void onUpdate({ enabled: !guard.enabled })}
            className={smallButton}
          >
            {guard.enabled ? '끄기' : '켜기'}
          </button>
        )}
      </div>
      <p className="mb-3 text-xs text-gray-500">
        {guard.state === 'on'
          ? `허용 국가 ${list.join(', ')} 밖에서 오는 SSH 접속은 계정·성공 여부와 상관없이 실패 횟수를 기다리지 않고 바로 막습니다. 접속만 하면 SSH 만, 비밀번호 실패·없는 계정·root 시도가 보이면 SSH·사이트 모두 막습니다. 내 IP·내부망·위치를 모르는 IP 는 막지 않습니다.`
          : guard.state === 'no-geo'
            ? 'IP 위치 파일(CONTROL_IP_GEO_DB_PATH)이 준비되지 않아 나라를 알 수 없어 쉬고 있습니다.'
            : `꺼 두었습니다. 켜면 최근 7일 기록부터 다시 보고 허용 국가 ${list.join(', ')} 밖의 IP 를 막습니다.`}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {allowed.map((c) => (
          <span
            key={c}
            className="inline-flex items-center gap-1 rounded-full border border-emerald-800 px-2 py-0.5 text-xs text-emerald-300"
          >
            {c} · {countryName(c, names.get(c))}
            {canManage && allowed.length > 1 && (
              <button
                type="button"
                aria-label={`${c} 허용 해제`}
                disabled={disabled}
                onClick={() =>
                  confirm(
                    `${c} 를 허용 국가에서 뺄까요?\n다음 확인(30초 안)부터 최근 7일 동안 ${c} 에서 SSH 로 들어온 IP 를 막습니다. 내 IP 로 표시한 주소는 막지 않습니다.`,
                    `country:${c}`,
                    () =>
                      onUpdate({
                        allowedCountries: allowed.filter((a) => a !== c),
                      }),
                  )
                }
                className="text-emerald-500 hover:text-white disabled:opacity-40"
              >
                <X size={11} />
              </button>
            )}
          </span>
        ))}
        {canManage && (
          <form
            className="inline-flex items-center gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              const next = code.trim().toUpperCase();
              if (!/^[A-Z]{2}$/.test(next)) return;
              void onUpdate({ allowedCountries: [...allowed, next] }).then(() =>
                setCode(''),
              );
            }}
          >
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="JP"
              maxLength={2}
              aria-label="허용할 국가 코드"
              className="w-14 rounded-lg border border-gray-800 bg-gray-900 px-2 py-1 font-mono text-xs uppercase text-white placeholder:text-gray-600 focus:border-sky-700 focus:outline-none"
            />
            <button
              type="submit"
              disabled={disabled || !/^[a-zA-Z]{2}$/.test(code.trim())}
              className={smallButton}
            >
              {disabled ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Plus size={12} />
              )}
              허용
            </button>
          </form>
        )}
      </div>

      {leftovers.map((b) => (
        <div
          key={b.country}
          className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-900/60 bg-amber-950/20 px-3 py-2 text-xs text-amber-200"
        >
          <span>
            {b.country} 를 허용했지만 이 규칙이 막아 둔 IP {b.count}개가 남아
            있습니다. 다시 허용해도 저절로 풀지 않습니다.
          </span>
          {canManage && (
            <button
              type="button"
              disabled={disabled}
              onClick={() =>
                confirm(
                  `${b.country} 에서 허용 국가 밖이라 막은 IP ${b.count}개를 모두 풀까요?\n다른 규칙으로 막은 차단은 그대로 둡니다.`,
                  `country-unblock:${b.country}`,
                  () => onUnblockCountry(b.country),
                )
              }
              className={smallButton}
            >
              이 나라 차단 모두 해제
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
