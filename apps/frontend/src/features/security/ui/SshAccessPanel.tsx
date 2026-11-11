import { useMemo, useState, type ReactNode } from 'react';
import {
  Ban,
  CheckCircle2,
  Loader2,
  Plug,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Star,
  UserCheck,
  X,
} from 'lucide-react';
import { useModalStore } from '@/shared/model/modal.store';
import { usePermissions, formatShortDateTime } from '@/shared/lib';
import { PERMISSIONS } from '@/shared/config/permissions';
import { useSshAccess } from '../model/useSshAccess';
import type {
  SshAuditEvent,
  SshIpScope,
  SshIpSummary,
} from '../model/security.types';

const SETUP_GUARD = 'sudo bash ~/server-watchdog/setup-ssh-guard.sh';
const SETUP_AUDIT = 'sudo bash ~/server-watchdog/setup-ssh-audit.sh';

const SCOPE_LABEL: Record<SshIpScope, { label: string; className: string }> = {
  local: { label: '맥미니', className: 'border-gray-700 text-gray-400' },
  lan: { label: '내부망', className: 'border-gray-700 text-gray-400' },
  tailscale: { label: 'Tailscale', className: 'border-sky-800 text-sky-300' },
  external: { label: '외부', className: 'border-amber-800 text-amber-300' },
  unknown: { label: '-', className: 'border-gray-800 text-gray-500' },
};

const RESULT_CLASS: Record<SshAuditEvent['result'], string> = {
  성공: 'text-emerald-300',
  실패: 'text-red-300',
  없는계정: 'text-red-300',
  시도초과: 'text-red-300',
  인증중끊김: 'text-gray-500',
};

type EventFilter = 'external' | 'success' | 'failure' | 'all';

function blockConfirmation(ip: string): string {
  return `${ip}를 차단 목록에 추가할까요?\n적용 중인 방화벽 규칙에 따라 SSH와 운영 사이트 접속이 차단될 수 있습니다.`;
}

function ScopeBadge({ scope }: { scope: SshIpScope }) {
  const s = SCOPE_LABEL[scope];
  return (
    <span
      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] ${s.className}`}
    >
      {s.label}
    </span>
  );
}

function Section({
  title,
  count,
  children,
  action,
}: {
  title: string;
  count?: number;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">
          {title}
          {count !== undefined && ` (${count})`}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

const smallButton =
  'inline-flex shrink-0 items-center gap-1 rounded-lg border border-gray-800 px-2 py-1 text-xs text-gray-300 hover:border-gray-600 hover:text-white disabled:opacity-40';

export function SshAccessPanel() {
  const [days, setDays] = useState(7);
  const [filter, setFilter] = useState<EventFilter>('external');
  const [blockIp, setBlockIp] = useState('');
  const [blockReason, setBlockReason] = useState('');
  const [working, setWorking] = useState<string | null>(null);
  const ssh = useSshAccess(days);
  const { showConfirm, showAlert } = useModalStore();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission(PERMISSIONS.SECURITY_MANAGE);
  const data = ssh.data;

  const blocked = useMemo(
    () => new Set((data?.blocks ?? []).map((b) => b.ip)),
    [data],
  );

  const act = async (key: string, fn: () => Promise<unknown>) => {
    setWorking(key);
    try {
      await fn();
    } catch (e) {
      showAlert(e instanceof Error ? e.message : String(e), '요청 실패');
    } finally {
      setWorking(null);
    }
  };

  const confirmAct = (
    message: string,
    key: string,
    fn: () => Promise<unknown>,
  ) => showConfirm(message, () => void act(key, fn), '확인');

  const events = useMemo(() => {
    const list = data?.events ?? [];
    switch (filter) {
      case 'external':
        return list.filter((e) => e.scope === 'external');
      case 'success':
        return list.filter((e) => e.result === '성공');
      case 'failure':
        return list.filter(
          (e) => e.result !== '성공' && e.result !== '인증중끊김',
        );
      default:
        return list;
    }
  }, [data, filter]);

  if (!data) {
    return ssh.error ? (
      <div
        role="alert"
        className="rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-400"
      >
        {ssh.error}
        <button
          className={`${smallButton} ml-3`}
          onClick={() => void ssh.reload()}
        >
          다시 시도
        </button>
      </div>
    ) : (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={24} className="animate-spin text-gray-600" />
      </div>
    );
  }

  const { summary, guard } = data;
  const guardOk = guard.installed && guard.running;
  const ipActions = (row: { ip: string; scope: SshIpScope; known: boolean }) =>
    canManage && row.scope === 'external' ? (
      <div className="flex shrink-0 gap-1">
        {!row.known && (
          <button
            className={smallButton}
            disabled={working !== null}
            onClick={() =>
              confirmAct(
                `${row.ip} 를 내 IP 로 표시할까요?\n표시하면 ★ 경고에서 빠지고 자동 차단 대상에서도 빠집니다.`,
                `known:${row.ip}`,
                () => ssh.addKnown(row.ip),
              )
            }
          >
            <UserCheck size={12} />
            <span className="hidden sm:inline">내 IP</span>
          </button>
        )}
        {!row.known && !blocked.has(row.ip) && (
          <button
            className={`${smallButton} hover:border-red-700 hover:text-red-300`}
            disabled={working !== null}
            onClick={() =>
              confirmAct(
                blockConfirmation(row.ip),
                `block:${row.ip}`,
                () => ssh.block(row.ip, 'Control 에서 차단'),
              )
            }
          >
            <Ban size={12} />
            <span className="hidden sm:inline">차단</span>
          </button>
        )}
      </div>
    ) : null;

  return (
    <div className="space-y-6">
      {ssh.error && (
        <p
          role="alert"
          className="rounded-lg border border-amber-800 bg-amber-950/30 p-3 text-sm text-amber-200"
        >
          새로고침에 실패해 이전 조회 결과를 표시합니다. {ssh.error}
        </p>
      )}
      {/* 상태 */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Stat
          label="처음 보는 외부 성공"
          value={summary.unknownExternalSuccessIps}
          tone={summary.unknownExternalSuccessIps > 0 ? 'danger' : 'ok'}
          hint={`외부 성공 ${summary.externalSuccess}회`}
        />
        <Stat
          label="외부 실패"
          value={summary.externalFailure}
          tone={summary.externalFailure > 0 ? 'warn' : 'ok'}
          hint={`최근 ${days}일`}
        />
        <Stat
          label="막고 있는 IP"
          value={data.blocks.length}
          tone={guardOk ? 'ok' : 'warn'}
          hint={
            guardOk
              ? `차단기 동작 중 · ${formatShortDateTime(guard.updatedAt)}`
              : guard.installed
                ? '차단기 멈춤'
                : '차단기 미설치'
          }
        />
        <Stat
          label="열린 세션"
          value={data.sessions.length}
          tone="neutral"
          hint={`인증 중 ${data.pendingAuth}개`}
        />
      </div>

      {(!data.recorder.exists || !guardOk) && (
        <div className="rounded-lg border border-amber-900/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
          {!data.recorder.exists && (
            <p>
              접속 기록기가 꺼져 있습니다. 맥미니 터미널에서 한 번 실행하세요:{' '}
              <code className="break-all font-mono text-amber-100">
                {SETUP_AUDIT}
              </code>
            </p>
          )}
          {!guardOk && (
            <p>
              {guard.installed
                ? '차단기 상태 파일이 2분 넘게 갱신되지 않았습니다. 다시 켜려면: '
                : '차단기가 아직 설치되지 않아 차단 목록이 방화벽에 반영되지 않습니다. 맥미니 터미널에서 한 번 실행하세요: '}
              <code className="break-all font-mono text-amber-100">
                {SETUP_GUARD}
              </code>
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {[1, 7, 30].map((d) => (
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
          onClick={() => void ssh.reload()}
          className={`${smallButton} ml-auto`}
          disabled={ssh.loading}
        >
          <RefreshCw size={12} className={ssh.loading ? 'animate-spin' : ''} />
          새로고침
        </button>
      </div>

      {/* 열린 세션 */}
      <Section title="열린 SSH 세션" count={data.sessions.length}>
        {data.sessions.length === 0 ? (
          <Empty text="지금 열린 SSH 세션이 없습니다" />
        ) : (
          <div className="space-y-2">
            {data.sessions.map((s) => (
              <div
                key={s.pid}
                className="flex items-center gap-3 rounded-xl border border-gray-800 bg-gray-900/60 p-3"
              >
                <Plug size={16} className="shrink-0 text-emerald-400" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm text-white">
                      {s.ip ?? '주소 모름'}
                    </span>
                    <ScopeBadge scope={s.scope} />
                    {s.known && <KnownBadge />}
                    {s.scope === 'external' && !s.known && <UnknownBadge />}
                  </div>
                  <p className="mt-1 truncate text-xs text-gray-500">
                    {s.user}
                    {s.tty ? ` · ${s.tty}` : ' · 터미널 없음(터널·명령)'} · 시작{' '}
                    {formatShortDateTime(s.startedAt)} · pid {s.pid}
                  </p>
                </div>
                {canManage && (
                  <div className="flex shrink-0 gap-1">
                    {s.ip && s.scope === 'external' && !s.known && (
                      <button
                        className={smallButton}
                        disabled={working !== null}
                        onClick={() =>
                          confirmAct(
                            `${s.ip} 를 내 IP 로 표시할까요?`,
                            `known:${s.ip}`,
                            () =>
                              s.ip ? ssh.addKnown(s.ip) : Promise.resolve(),
                          )
                        }
                      >
                        <UserCheck size={12} />
                        <span className="hidden sm:inline">내 IP</span>
                      </button>
                    )}
                    <button
                      className={`${smallButton} hover:border-red-700 hover:text-red-300`}
                      disabled={working !== null}
                      onClick={() =>
                        confirmAct(
                          `${s.user} 세션(${s.ip ?? '주소 모름'})을 끊을까요?\n그 연결로 쓰던 터미널·터널도 같이 끊깁니다.`,
                          `kill:${s.pid}`,
                          () => ssh.terminate(s.pid),
                        )
                      }
                    >
                      {working === `kill:${s.pid}` ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <X size={12} />
                      )}
                      끊기
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* 차단 */}
      <Section title="차단 목록 IP" count={data.blocks.length}>
        {canManage && (
          <form
            className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto]"
            onSubmit={(e) => {
              e.preventDefault();
              const ip = blockIp.trim();
              if (!ip) return;
              confirmAct(
                blockConfirmation(ip),
                `block:${ip}`,
                async () => {
                  await ssh.block(ip, blockReason.trim() || undefined);
                  setBlockIp('');
                  setBlockReason('');
                },
              );
            }}
          >
            <input
              value={blockIp}
              onChange={(e) => setBlockIp(e.target.value)}
              placeholder="막을 IP"
              className="min-w-0 rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 font-mono text-sm text-white placeholder:text-gray-600 focus:border-red-700 focus:outline-none"
            />
            <input
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              placeholder="이유 (선택)"
              className="min-w-0 rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-red-700 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!blockIp.trim() || working !== null}
              className="inline-flex items-center justify-center gap-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40"
            >
              <Ban size={14} /> 차단
            </button>
          </form>
        )}
        <p className="mb-3 text-xs text-gray-500">
          자동 차단: 외부에서 root·없는 계정으로 시도하면 바로, 그 밖의 계정은
          1시간에 3번 실패하면 막습니다. 자동으로 풀지 않습니다. 성공한 적 있는
          IP·내 IP·내부망· Tailscale 은 막지 않습니다. 막은 IP 는 SSH 뿐 아니라
          맥미니에서 운영 중인 사이트에도 적용되도록 설정할 수 있습니다. 이
          화면은 요청 목록이며 실제 적용 범위는 서버에 설치된 방화벽 규칙에
          따릅니다.
        </p>
        {data.blocks.length === 0 ? (
          <Empty text="막고 있는 IP 가 없습니다" />
        ) : (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {data.blocks.map((b) => (
              <div
                key={`${b.source}:${b.ip}`}
                className="flex items-start gap-3 rounded-xl border border-gray-800 bg-gray-900/60 p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-mono text-sm text-white">
                      {b.ip}
                    </span>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] ${
                        b.source === 'auto'
                          ? 'border-violet-500/30 bg-violet-500/10 text-violet-300'
                          : 'border-blue-500/30 bg-blue-500/10 text-blue-300'
                      }`}
                    >
                      {b.source === 'auto' ? '자동' : '수동'}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-gray-500">
                    {b.blockedAt ?? '-'}
                    {b.reason ? ` · ${b.reason}` : ''}
                  </p>
                </div>
                {canManage && (
                  <button
                    className={smallButton}
                    disabled={working !== null}
                    onClick={() =>
                      confirmAct(
                        `${b.ip}의 차단을 풀까요?${
                          b.source === 'auto'
                            ? '\n같은 시도가 다시 오면 또 자동으로 막힙니다. 내 IP 라면 "내 IP" 로 표시하세요.'
                            : ''
                        }`,
                        `unblock:${b.ip}`,
                        () => ssh.unblock(b.ip),
                      )
                    }
                  >
                    해제
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* IP 별 */}
      <Section title={`IP 별 요약 · 최근 ${days}일`} count={summary.ips.length}>
        {summary.ips.length === 0 ? (
          <Empty text="기록이 없습니다" />
        ) : (
          <div className="space-y-2">
            {summary.ips.slice(0, 50).map((r: SshIpSummary) => (
              <div
                key={r.ip}
                className={`flex items-center gap-3 rounded-xl border bg-gray-900/60 p-3 ${
                  r.scope === 'external' && r.success > 0 && !r.known
                    ? 'border-red-800'
                    : 'border-gray-800'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm text-white">{r.ip}</span>
                    <ScopeBadge scope={r.scope} />
                    {r.known && <KnownBadge />}
                    {r.scope === 'external' && r.success > 0 && !r.known && (
                      <UnknownBadge />
                    )}
                    {blocked.has(r.ip) && (
                      <span className="rounded-full border border-red-800 px-2 py-0.5 text-[10px] text-red-300">
                        차단 중
                      </span>
                    )}
                  </div>
                  <p className="mt-1 truncate text-xs text-gray-500">
                    <span className="text-emerald-400">성공 {r.success}</span> ·{' '}
                    <span className="text-red-400">실패 {r.failure}</span> ·
                    계정 {r.users.join(', ') || '-'} · 마지막 {r.lastAt}
                  </p>
                </div>
                {ipActions(r)}
              </div>
            ))}
          </div>
        )}
        {summary.triedUsers.length > 0 && (
          <p className="mt-3 text-xs text-gray-500">
            시도된 계정:{' '}
            {summary.triedUsers
              .map((u) => `${u.user} ${u.count}회`)
              .join(' · ')}
          </p>
        )}
      </Section>

      {/* 기록 */}
      <Section
        title="접속 기록"
        count={events.length}
        action={
          <div className="flex gap-1">
            {(
              [
                ['external', '외부'],
                ['success', '성공'],
                ['failure', '실패'],
                ['all', '전체'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`rounded-md px-2 py-0.5 text-xs ${
                  filter === key
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-500 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        }
      >
        {events.length === 0 ? (
          <Empty text="해당하는 기록이 없습니다" />
        ) : (
          <div className="divide-y divide-gray-900 overflow-hidden rounded-xl border border-gray-800 bg-gray-900/40">
            {events.slice(0, 200).map((e, i) => (
              <div
                key={`${e.at}-${i}`}
                className="flex items-center gap-3 px-3 py-2 text-xs"
              >
                <span className="w-32 shrink-0 font-mono text-gray-500">
                  {e.at.slice(5)}
                </span>
                <span className={`w-16 shrink-0 ${RESULT_CLASS[e.result]}`}>
                  {e.result}
                </span>
                <span className="min-w-0 flex-1 truncate font-mono text-gray-300">
                  {e.ip ?? '-'}{' '}
                  <span className="text-gray-500">· {e.user ?? '-'}</span>
                  {e.method && (
                    <span className="text-gray-600"> · {e.method}</span>
                  )}
                </span>
                <span className="hidden shrink-0 sm:inline">
                  <ScopeBadge scope={e.scope} />
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* 내 IP */}
      <Section title="내 IP" count={data.knownIps.length}>
        <p className="mb-2 text-xs text-gray-500">
          내가 쓰는 공인 IP 입니다. 여기 있는 IP 에서 성공한 접속은 경고(★)를
          띄우지 않고, 자동 차단하지 않습니다.
        </p>
        {data.knownIps.length === 0 ? (
          <Empty text="등록된 IP 가 없습니다. 열린 세션이나 IP 요약에서 '내 IP' 를 누르세요" />
        ) : (
          <div className="flex flex-wrap gap-2">
            {data.knownIps.map((ip) => (
              <span
                key={ip}
                className="inline-flex items-center gap-1 rounded-full border border-emerald-800 bg-emerald-950/30 px-3 py-1 font-mono text-xs text-emerald-200"
              >
                {ip}
                {canManage && (
                  <button
                    aria-label={`${ip} 빼기`}
                    className="text-emerald-500 hover:text-white"
                    disabled={working !== null}
                    onClick={() =>
                      confirmAct(
                        `${ip} 를 내 IP 목록에서 뺄까요?`,
                        `unknown:${ip}`,
                        () => ssh.removeKnown(ip),
                      )
                    }
                  >
                    <X size={12} />
                  </button>
                )}
              </span>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint: string;
  tone: 'ok' | 'warn' | 'danger' | 'neutral';
}) {
  const color = {
    ok: 'text-emerald-300',
    warn: 'text-amber-300',
    danger: 'text-red-300',
    neutral: 'text-white',
  }[tone];
  const Icon =
    tone === 'danger'
      ? ShieldAlert
      : tone === 'ok'
        ? ShieldCheck
        : CheckCircle2;
  return (
    <div className="min-w-0 rounded-xl border border-gray-800 bg-gray-900/60 p-3">
      <p className="flex items-center gap-1 truncate text-xs text-gray-500">
        <Icon size={12} className={`shrink-0 ${color}`} />
        {label}
      </p>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
      <p className="mt-1 truncate text-[11px] text-gray-500">{hint}</p>
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

function KnownBadge() {
  return (
    <span className="shrink-0 rounded-full border border-emerald-800 px-2 py-0.5 text-[10px] text-emerald-300">
      내 IP
    </span>
  );
}

function UnknownBadge() {
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-red-800 bg-red-950/40 px-2 py-0.5 text-[10px] text-red-300">
      <Star size={10} /> 처음 보는 IP
    </span>
  );
}
