import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clipboard,
  CloudCog,
  Code2,
  Eye,
  EyeOff,
  FileClock,
  KeyRound,
  Loader2,
  RefreshCw,
  RotateCcw,
  Save,
  ServerCog,
  ShieldCheck,
} from 'lucide-react';
import { useModalStore } from '@/shared/model';
import type { BackupStatus, SecretBackup } from '../model/types';
import { useKeyManagement } from '../model/useKeyManagement';

const STATUS: Record<BackupStatus, { label: string; className: string }> = {
  backed_up: {
    label: 'DB 백업 완료',
    className: 'text-cyan-300 bg-cyan-950/50',
  },
  secret_created: {
    label: 'Secret 생성',
    className: 'text-sky-300 bg-sky-950/50',
  },
  deployment_queued: {
    label: '배포 대기',
    className: 'text-amber-300 bg-amber-950/50',
  },
  deployment_running: {
    label: '배포 중',
    className: 'text-orange-300 bg-orange-950/50',
  },
  deployed: {
    label: '배포 완료',
    className: 'text-emerald-300 bg-emerald-950/50',
  },
  failed: { label: '실패', className: 'text-red-300 bg-red-950/50' },
};

function formatDate(value: string | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(new Date(value));
}

function BackupRow({
  backup,
  disabled,
  onRestore,
  onRetry,
}: {
  backup: SecretBackup;
  disabled: boolean;
  onRestore: () => void;
  onRetry: () => void;
}) {
  const status = STATUS[backup.status];
  return (
    <article className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <span>v{backup.sourceVersion}</span>
            <span className="text-slate-600">to</span>
            <span>{backup.newVersion ? `v${backup.newVersion}` : '-'}</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {formatDate(backup.createdAt)} · {backup.actorEmail ?? 'system'}
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${status.className}`}
        >
          {status.label}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {backup.changedKeys.map((key) => (
          <span
            key={key}
            className="rounded-md border border-slate-800 bg-slate-900 px-2 py-1 font-mono text-[11px] text-slate-300"
          >
            {key}
          </span>
        ))}
      </div>
      {backup.errorMessage && (
        <p className="mt-3 rounded-lg bg-red-950/40 px-3 py-2 text-xs text-red-300">
          {backup.errorMessage}
        </p>
      )}
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={onRestore}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 hover:border-amber-500 hover:text-amber-200 disabled:opacity-40"
        >
          <RotateCcw size={13} /> 이 백업으로 복원
        </button>
        {backup.status === 'failed' && backup.newVersion && (
          <button
            type="button"
            disabled={disabled}
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-800 px-2.5 py-1.5 text-xs text-red-300 hover:bg-red-950/50 disabled:opacity-40"
          >
            <RefreshCw size={13} /> 배포 재시도
          </button>
        )}
        {backup.deploymentUrl && (
          <a
            href={backup.deploymentUrl}
            target="_blank"
            rel="noreferrer"
            className="ml-auto text-xs text-sky-400 hover:text-sky-300"
          >
            Actions 열기
          </a>
        )}
      </div>
    </article>
  );
}

export function KeyManagementConsole() {
  const {
    target,
    backups,
    revealed,
    editorValue,
    isLoading,
    isWorking,
    error,
    setEditorValue,
    clearReveal,
    load,
    reveal,
    save,
    restore,
    retry,
  } = useKeyManagement();
  const { showAlert, showConfirm } = useModalStore();
  const [showApi, setShowApi] = useState(false);

  const hasChanges = Boolean(revealed && editorValue !== revealed.envFile);

  const copy = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value);
    showAlert(`${label}을 클립보드에 복사했습니다.`);
  };

  const confirmSave = () => {
    if (!revealed || !hasChanges) return;
    showConfirm(
      '현재 Secret Manager 값을 PostgreSQL에 암호화 백업한 뒤 새 버전을 만들고 GoLe 운영 배포를 시작합니다. 계속할까요?',
      () => {
        void save()
          .then((result) => {
            if (!result) return;
            showAlert(
              `Secret v${result.version} 생성 및 배포 요청이 완료되었습니다.\n변경 키: ${result.changedKeys.join(', ')}`,
              '배포 요청 완료',
            );
          })
          .catch(() => undefined);
      },
      '운영 환경 변수 변경',
    );
  };

  const confirmRestore = (backup: SecretBackup) => {
    showConfirm(
      `v${backup.sourceVersion} 당시 값으로 복원할까요? 현재 값도 먼저 PostgreSQL에 새 암호화 백업으로 저장됩니다.`,
      () => {
        void restore(backup.id)
          .then((result) => {
            if (result) {
              showAlert(
                `복원용 Secret v${result.version} 생성 및 배포를 요청했습니다.`,
                '복원 요청 완료',
              );
            }
          })
          .catch(() => undefined);
      },
      '백업 복원',
    );
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#071018] text-slate-300">
        <Loader2 className="mr-2 animate-spin" size={20} /> 운영 키 연결 확인 중
      </div>
    );
  }

  if (!target) {
    return (
      <div className="flex h-full items-center justify-center bg-[#071018] p-6">
        <div className="max-w-md rounded-2xl border border-red-900/60 bg-red-950/20 p-6 text-red-200">
          운영 키 대상을 불러오지 못했습니다. {error}
        </div>
      </div>
    );
  }

  const patchCommand = `curl -X PATCH 'https://control.kscold.com/api/key-management/targets/${target.id}/environment/MY_KEY' \\
  -H 'Authorization: Bearer $TOKEN' \\
  -H 'Content-Type: application/json' \\
  --data '{"secretValue":"new-value","expectedVersion":"${target.version}"}'`;
  const fullCommand = `jq -n --rawfile env .env --arg version '${target.version}' \\
  '{envFile: $env, expectedVersion: $version}' | \\
curl -X PUT 'https://control.kscold.com/api/key-management/targets/${target.id}/environment' \\
  -H 'Authorization: Bearer $TOKEN' \\
  -H 'Content-Type: application/json' --data-binary @-`;

  return (
    <div className="h-full overflow-auto bg-[#071018] text-slate-100">
      <div className="mx-auto max-w-[1540px] p-4 sm:p-6 lg:p-8">
        <header className="relative overflow-hidden rounded-[28px] border border-amber-400/20 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.16),transparent_35%),linear-gradient(135deg,#0d1822,#081019)] p-6 shadow-2xl shadow-black/30 sm:p-8">
          <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full border border-amber-300/10" />
          <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-amber-200">
                <ShieldCheck size={14} /> PRODUCTION KEY VAULT
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white sm:text-4xl">
                GoLe 환경 변수 운영실
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
                수정 전 DB 암호화 백업, Secret Manager 불변 버전, GCP 배포와
                실패 롤백을 하나의 흐름으로 처리합니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isWorking}
                onClick={() => void load()}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-2.5 text-sm text-slate-200 hover:border-slate-500 disabled:opacity-50"
              >
                <RefreshCw
                  size={16}
                  className={isWorking ? 'animate-spin' : ''}
                />
                새로고침
              </button>
              {revealed ? (
                <button
                  type="button"
                  onClick={clearReveal}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-800 px-4 py-2.5 text-sm text-white"
                >
                  <EyeOff size={16} /> 즉시 숨기기
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isWorking}
                  onClick={() => void reveal()}
                  className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-amber-300 disabled:opacity-50"
                >
                  <Eye size={16} /> 60초 동안 공개
                </button>
              )}
            </div>
          </div>
        </header>

        {error && (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-red-900/70 bg-red-950/30 px-4 py-3 text-sm text-red-200">
            <AlertTriangle className="mt-0.5 shrink-0" size={17} /> {error}
          </div>
        )}

        <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ['Target', target.id, ServerCog],
            ['Secret version', `v${target.version}`, FileClock],
            ['Environment keys', `${target.keyCount} keys`, KeyRound],
            ['GCP instance', target.instanceName, CloudCog],
          ].map(([label, value, Icon]) => (
            <div
              key={String(label)}
              className="rounded-2xl border border-slate-800 bg-slate-900/55 p-4"
            >
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-slate-500">
                <Icon size={14} /> {String(label)}
              </div>
              <p className="mt-2 truncate font-mono text-sm text-slate-100">
                {String(value)}
              </p>
            </div>
          ))}
        </section>

        <div className="mt-5 grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/45">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-3 sm:px-5">
              <div>
                <h2 className="font-semibold text-white">gole.env</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {revealed
                    ? `v${revealed.version} · 60초 후 브라우저 메모리에서 제거`
                    : '값은 기본적으로 마스킹됩니다.'}
                </p>
              </div>
              <div className="flex gap-2">
                {revealed && (
                  <button
                    type="button"
                    onClick={() => void copy(editorValue, '.env')}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:text-white"
                  >
                    <Clipboard size={14} /> 복사
                  </button>
                )}
                <button
                  type="button"
                  disabled={!hasChanges || isWorking}
                  onClick={confirmSave}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-emerald-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-600"
                >
                  {isWorking ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Save size={14} />
                  )}
                  백업 후 배포
                </button>
              </div>
            </div>
            {revealed ? (
              <textarea
                value={editorValue}
                onChange={(event) => setEditorValue(event.target.value)}
                spellCheck={false}
                autoComplete="off"
                className="block h-[540px] w-full resize-y bg-[#071018] p-5 font-mono text-[13px] leading-6 text-slate-200 outline-none selection:bg-amber-400/30"
                aria-label="GoLe 운영 환경 변수 편집기"
              />
            ) : (
              <div className="min-h-[540px] bg-[#071018] p-5">
                <div className="mb-5 flex items-center gap-3 rounded-xl border border-emerald-900/60 bg-emerald-950/20 p-4 text-sm text-emerald-200">
                  <CheckCircle2 size={18} /> 값은 숨겨져 있으며 키 이름만 표시
                  중입니다.
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {target.keys.map((key) => (
                    <div
                      key={key}
                      className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2.5 font-mono text-xs text-slate-300"
                    >
                      <span className="truncate">{key}</span>
                      <span className="ml-3 text-slate-700">••••••</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <aside className="min-w-0 space-y-5">
            <section className="rounded-2xl border border-slate-800 bg-slate-900/45 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-white">Backup ledger</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    최근 변경 및 배포 상태
                  </p>
                </div>
                <FileClock size={18} className="text-amber-300" />
              </div>
              <div className="mt-4 max-h-[650px] space-y-3 overflow-auto pr-1">
                {backups.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-700 p-5 text-center text-xs text-slate-500">
                    아직 control에서 만든 백업이 없습니다.
                  </p>
                ) : (
                  backups.map((backup) => (
                    <BackupRow
                      key={backup.id}
                      backup={backup}
                      disabled={isWorking}
                      onRestore={() => confirmRestore(backup)}
                      onRetry={() => void retry(backup.id)}
                    />
                  ))
                )}
              </div>
            </section>
          </aside>
        </div>

        <section className="mt-5 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/45">
          <button
            type="button"
            onClick={() => setShowApi((current) => !current)}
            className="flex w-full items-center justify-between px-5 py-4 text-left"
          >
            <span className="flex items-center gap-2 font-semibold text-white">
              <Code2 size={18} className="text-sky-300" /> 개발자 API
            </span>
            <span className="text-xs text-slate-500">
              {showApi ? '접기' : 'JWT와 role 권한으로 사용'}
            </span>
          </button>
          {showApi && (
            <div className="grid gap-4 border-t border-slate-800 p-5 lg:grid-cols-2">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-200">
                    단일 키 변경
                  </h3>
                  <button
                    type="button"
                    onClick={() => void copy(patchCommand, 'API 예제')}
                    className="text-xs text-sky-400"
                  >
                    복사
                  </button>
                </div>
                <pre className="overflow-auto rounded-xl bg-[#050b11] p-4 text-xs leading-5 text-slate-300">
                  {patchCommand}
                </pre>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-200">
                    전체 .env 반영
                  </h3>
                  <button
                    type="button"
                    onClick={() => void copy(fullCommand, 'API 예제')}
                    className="text-xs text-sky-400"
                  >
                    복사
                  </button>
                </div>
                <pre className="overflow-auto rounded-xl bg-[#050b11] p-4 text-xs leading-5 text-slate-300">
                  {fullCommand}
                </pre>
              </div>
              <p className="lg:col-span-2 text-xs leading-5 text-slate-500">
                먼저 <code>POST /api/auth/login</code>으로 받은 accessToken을
                TOKEN에 넣습니다. 서버는 JWT의 <code>secrets:write</code>와{' '}
                <code>secrets:deploy</code> 권한을 모두 확인하며,
                expectedVersion이 최신과 다르면 409로 거절합니다. 응답이나 요청
                본문은 서버 HTTP 로그에 기록되지 않습니다.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
