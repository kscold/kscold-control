import { useEffect, useMemo, useState } from 'react';
import { Loader2, MapPinOff, RefreshCw, X } from 'lucide-react';
import { smallButton, usePaged } from '../model/paging';
import { useAttackMap } from '../model/useAttackMap';
import type { AttackCountry, AttackPoint } from '../model/security.types';
import { blockedPercent, dotRadius, projectToMap } from '../lib/attackMap';
import { flagEmoji } from '../lib/flag';
import { WORLD_COUNTRIES, WORLD_MAP } from '../lib/worldMap.generated';
import { GeoLabel } from './GeoLabel';
import { Pager } from './Pager';

/** 위치를 못 찾은 IP 묶음의 키 */
const UNKNOWN = '??';
const keyOf = (country: string | null) => country ?? UNKNOWN;

const DISABLED_TEXT = {
  off: 'IP 위치 파일이 설정되지 않았습니다. 파일을 받은 뒤 CONTROL_IP_GEO_DB_PATH 에 경로를 넣고 Control 을 다시 시작하세요.',
  loading: 'IP 위치 파일을 읽는 중입니다. 잠시 뒤 새로고침하세요.',
  unavailable:
    'CONTROL_IP_GEO_DB_PATH 의 파일을 읽지 못했습니다. 경로와 파일을 확인한 뒤 Control 을 다시 시작하세요.',
} as const;

const DAY_OPTIONS = [1, 7, 30] as const;

/** 접속 보안 "공격 지도" — 공격 IP 를 세계 지도에 찍고 나라별 순위를 보여 준다 */
export default function AttackMapPanel() {
  const [days, setDays] = useState<number>(7);
  const [selected, setSelected] = useState<string | null>(null);
  const map = useAttackMap(days);
  const view = map.data;

  const countries = useMemo(
    () => (view?.enabled ? view.countries : []),
    [view],
  );
  const points = useMemo(() => (view?.enabled ? view.points : []), [view]);
  const active =
    selected && countries.some((c) => keyOf(c.country) === selected)
      ? selected
      : null;
  const shown = useMemo(
    () =>
      active
        ? points.filter((p) => keyOf(p.geo?.country ?? null) === active)
        : points,
    [points, active],
  );
  const ipPage = usePaged(shown, 10);
  const { setPage } = ipPage;
  useEffect(() => setPage(0), [active, days, setPage]);

  const toggle = (key: string) => setSelected(active === key ? null : key);

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      {DAY_OPTIONS.map((d) => (
        <button
          key={d}
          onClick={() => setDays(d)}
          className={`rounded-lg border px-3 py-1 text-xs ${
            days === d
              ? 'border-blue-600 bg-blue-600/20 text-blue-200'
              : 'border-gray-800 text-gray-400 hover:text-white'
          }`}
        >
          {d === 1 ? '최근 24시간' : `${d}일`}
        </button>
      ))}
      <button
        onClick={() => void map.reload()}
        className={`${smallButton} ml-auto`}
        disabled={map.loading}
      >
        <RefreshCw size={12} className={map.loading ? 'animate-spin' : ''} />
        새로고침
      </button>
    </div>
  );

  if (!view) {
    return (
      <div className="space-y-4">
        {toolbar}
        {map.error ? (
          <p
            role="alert"
            className="rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-400"
          >
            {map.error}
          </p>
        ) : (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-gray-600" />
          </div>
        )}
      </div>
    );
  }

  if (!view.enabled) {
    return (
      <div className="space-y-4">
        {toolbar}
        <div className="flex items-start gap-3 rounded-xl border border-amber-900/50 bg-amber-950/30 p-4 text-sm text-amber-200">
          <MapPinOff size={18} className="mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p>{DISABLED_TEXT[view.reason]}</p>
            {view.reason === 'off' && (
              <code className="mt-2 block break-all font-mono text-xs text-amber-100">
                node scripts/fetch-ip-geo-db.mjs --out
                /절대/경로/dbip-city-lite.mmdb
              </code>
            )}
          </div>
        </div>
      </div>
    );
  }

  const totalAttempts = points.reduce((sum, p) => sum + p.attempts, 0);
  const blockedIps = points.filter((p) => p.blocked).length;
  const located = countries.filter((c) => c.country !== null).length;
  const activeCountry = countries.find((c) => keyOf(c.country) === active);

  return (
    <div className="space-y-6">
      {toolbar}
      {map.error && (
        <p
          role="alert"
          className="rounded-lg border border-amber-800 bg-amber-950/30 p-3 text-sm text-amber-200"
        >
          새로고침에 실패해 이전 조회 결과를 표시합니다. {map.error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Stat label="공격 IP" value={points.length} />
        <Stat label="시도" value={totalAttempts} />
        <Stat label="나라" value={located} />
        <Stat
          label="차단 중"
          value={`${blockedPercent(blockedIps, points.length)}%`}
          hint={`${blockedIps} / ${points.length} IP`}
        />
      </div>

      <section className="rounded-xl border border-gray-800 bg-gray-900/60 p-2 sm:p-3">
        <WorldAttackMap
          points={points}
          countries={countries}
          active={active}
          onSelect={toggle}
        />
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[11px] text-gray-500">
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500" /> 막지 않음
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-400" /> 차단 중
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-3.5 rounded-sm bg-red-950" /> 공격이 온
            나라
          </span>
          <span>점 크기는 시도 수 · 나라를 누르면 그 나라만 봅니다</span>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-500">
          나라별 순위 ({countries.length})
        </h2>
        {countries.length === 0 ? (
          <Empty text={`최근 ${days}일 동안 외부 공격 기록이 없습니다`} />
        ) : (
          <CountryRanking
            countries={countries}
            active={active}
            onSelect={toggle}
          />
        )}
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">
            공격 IP ({shown.length})
          </h2>
          {activeCountry && (
            <button className={smallButton} onClick={() => setSelected(null)}>
              {flagEmoji(activeCountry.country)}{' '}
              {activeCountry.countryName ?? '위치 모름'}만 보는 중
              <X size={12} />
            </button>
          )}
        </div>
        {shown.length === 0 ? (
          <Empty text="해당하는 IP 가 없습니다" />
        ) : (
          <div className="space-y-2">
            {ipPage.items.map((p) => (
              <AttackIpRow key={p.ip} point={p} />
            ))}
          </div>
        )}
        <Pager {...ipPage} />
      </section>

      <p className="text-[11px] text-gray-500">
        SSH 는 맥미니 접속 기록, 웹 로그인은 Control 로그인 실패·거절
        기록입니다. 내 IP·내부망·Tailscale 은 빼고 셉니다.{' '}
        <a
          href="https://db-ip.com"
          target="_blank"
          rel="noreferrer"
          className="text-gray-400 underline underline-offset-2 hover:text-white"
        >
          IP Geolocation by DB-IP
        </a>{' '}
        (CC BY 4.0, {view.builtAt.slice(0, 10)} 판) · 지도 Natural Earth
      </p>
    </div>
  );
}

function WorldAttackMap({
  points,
  countries,
  active,
  onSelect,
}: {
  points: AttackPoint[];
  countries: AttackCountry[];
  active: string | null;
  onSelect: (key: string) => void;
}) {
  const attacked = new Set(
    countries.flatMap((c) => (c.country ? [c.country] : [])),
  );
  const largest = Math.max(0, ...points.map((p) => p.attempts));
  // 큰 점을 먼저 그려 작은 점이 위에 보이게 한다
  const dots = points
    .filter((p) => p.geo)
    .sort((a, b) => b.attempts - a.attempts);
  const summary = countries
    .slice(0, 5)
    .map((c) => `${c.countryName ?? '위치 모름'} ${c.attempts}회`)
    .join(', ');

  return (
    <svg
      viewBox={`0 0 ${WORLD_MAP.width} ${WORLD_MAP.height}`}
      role="img"
      aria-label={`공격 IP 세계 지도. ${summary || '기록 없음'}`}
      className="block h-auto w-full"
    >
      <path d={WORLD_MAP.unnamed} className="fill-gray-800" />
      {Object.entries(WORLD_COUNTRIES).map(([code, d]) => {
        const hit = attacked.has(code);
        return (
          <path
            key={code}
            d={d}
            data-country={code}
            onClick={hit ? () => onSelect(code) : undefined}
            className={`stroke-gray-950 [stroke-width:0.4] ${
              active === code
                ? 'fill-red-600'
                : hit
                  ? 'cursor-pointer fill-red-950 hover:fill-red-900'
                  : 'fill-gray-800'
            }`}
          />
        );
      })}
      {dots.map((p) => {
        const [x, y] = projectToMap(p.geo!.lat, p.geo!.lon);
        const dimmed = active !== null && p.geo!.country !== active;
        return (
          <circle
            key={p.ip}
            cx={x}
            cy={y}
            r={dotRadius(p.attempts, largest)}
            data-ip={p.ip}
            className={`${
              p.blocked
                ? 'fill-slate-400 stroke-slate-200'
                : 'fill-red-500 stroke-red-200'
            } [stroke-width:0.5] ${dimmed ? 'opacity-10' : 'opacity-70'}`}
          >
            <title>
              {`${p.ip} · ${p.geo!.countryName}${p.geo!.city ? ` ${p.geo!.city}` : ''} · ${p.attempts}회${p.blocked ? ' · 차단 중' : ''}`}
            </title>
          </circle>
        );
      })}
    </svg>
  );
}

function CountryRanking({
  countries,
  active,
  onSelect,
}: {
  countries: AttackCountry[];
  active: string | null;
  onSelect: (key: string) => void;
}) {
  const paged = usePaged(countries, 10);
  return (
    <div>
      <div className="overflow-hidden rounded-xl border border-gray-800 bg-gray-900/40">
        <div className="grid grid-cols-[minmax(0,1fr)_3.5rem_2.5rem_3.5rem] gap-2 border-b border-gray-800 px-3 py-2 text-[11px] text-gray-500 sm:grid-cols-[minmax(0,1fr)_5rem_4rem_5rem]">
          <span>나라</span>
          <span className="text-right">시도</span>
          <span className="text-right">IP</span>
          <span className="text-right">차단</span>
        </div>
        {paged.items.map((c, i) => {
          const key = keyOf(c.country);
          const rank = paged.page * 10 + i + 1;
          return (
            <button
              key={key}
              onClick={() => onSelect(key)}
              aria-pressed={active === key}
              aria-label={`${c.countryName ?? '위치 모름'} 시도 ${c.attempts}회, IP ${c.ips}개, 차단 ${blockedPercent(c.blockedIps, c.ips)}%`}
              className={`grid w-full grid-cols-[minmax(0,1fr)_3.5rem_2.5rem_3.5rem] items-center gap-2 border-b border-gray-900 px-3 py-2 text-left text-sm last:border-b-0 sm:grid-cols-[minmax(0,1fr)_5rem_4rem_5rem] ${
                active === key
                  ? 'bg-red-950/40 text-white'
                  : 'text-gray-300 hover:bg-gray-800/60'
              }`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="w-5 shrink-0 text-right text-xs tabular-nums text-gray-500">
                  {c.country ? rank : '-'}
                </span>
                <span aria-hidden="true" className="shrink-0">
                  {flagEmoji(c.country) || '❔'}
                </span>
                <span className="truncate">{c.countryName ?? '위치 모름'}</span>
              </span>
              <span className="text-right tabular-nums">
                {c.attempts.toLocaleString()}
              </span>
              <span className="text-right tabular-nums">{c.ips}</span>
              <span
                className={`text-right text-xs tabular-nums ${
                  c.blockedIps === c.ips ? 'text-slate-400' : 'text-red-300'
                }`}
              >
                {blockedPercent(c.blockedIps, c.ips)}%
              </span>
            </button>
          );
        })}
      </div>
      <Pager {...paged} />
    </div>
  );
}

function AttackIpRow({ point: p }: { point: AttackPoint }) {
  const parts = [
    p.ssh.failures > 0 && `SSH 실패 ${p.ssh.failures}`,
    p.ssh.successes > 0 && `SSH 성공 ${p.ssh.successes}`,
    p.web.failures > 0 && `웹 로그인 실패 ${p.web.failures}`,
  ].filter(Boolean);
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-800 bg-gray-900/60 p-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-mono text-sm text-white">{p.ip}</span>
          <GeoLabel geo={p.geo} />
          {p.blocked ? (
            <span className="shrink-0 rounded-full border border-slate-600 px-2 py-0.5 text-[10px] text-slate-300">
              차단 중
            </span>
          ) : (
            <span className="shrink-0 rounded-full border border-red-800 px-2 py-0.5 text-[10px] text-red-300">
              막지 않음
            </span>
          )}
        </div>
        <p className="mt-1 truncate text-xs text-gray-500">
          <span className={p.ssh.successes > 0 ? 'text-amber-300' : ''}>
            {parts.join(' · ')}
          </span>{' '}
          · 마지막 {p.lastAt}
        </p>
      </div>
      <span className="shrink-0 text-right text-sm font-semibold tabular-nums text-gray-200">
        {p.attempts.toLocaleString()}
        <span className="ml-0.5 text-[10px] font-normal text-gray-500">회</span>
      </span>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-gray-800 bg-gray-900/60 p-3">
      <p className="truncate text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      {hint && (
        <p className="mt-1 truncate text-[11px] text-gray-500">{hint}</p>
      )}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-800 bg-gray-900/30 p-5 text-center text-sm text-gray-500">
      {text}
    </div>
  );
}
