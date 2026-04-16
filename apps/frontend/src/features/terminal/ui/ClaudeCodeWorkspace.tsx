import { useCallback, useEffect, useRef, useState, KeyboardEvent } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  FileCode2,
  Loader2,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Square,
  TerminalSquare,
  Wand2,
  X,
} from 'lucide-react';
import { useAuthStore } from '../../../shared/model/auth.store';
import { useModalStore } from '../../../shared/model/modal.store';
import { useClaudeRuntimeDiagnostics } from '../hooks/useClaudeRuntimeDiagnostics';
import { useTerminalSession } from '../hooks/useTerminalSession';
import { useTerminalSetup } from '../hooks/useTerminalSetup';
import { useTerminalSocket } from '../hooks/useTerminalSocket';
import { useWorkspaceFileEditor } from '../hooks/useWorkspaceFileEditor';
import { getTerminalSessionStorageKey } from '../lib/terminal.constants';
import type { ClaudeRuntimeCheck } from '../lib/terminal.types';
import { ClaudeWorkspaceFilePanel } from './ClaudeWorkspaceFilePanel';

interface ClaudeCodeWorkspaceProps {
  terminalId: string;
  onBackToTerminal?: () => void;
}

type WorkspacePanel = 'assistant' | 'runtime' | 'files';

const STARTER_PROMPTS = [
  '현재 프로젝트 구조를 빠르게 요약해줘',
  '지금 코드베이스에서 가장 위험한 부분부터 찾아줘',
  '다음 작업을 위한 실행 계획을 단계별로 제안해줘',
];

const CLAUDE_SHORTCUTS = ['/help', '/clear', '/status'];

function formatCheckLabel(check: ClaudeRuntimeCheck | undefined) {
  if (!check) return 'pending';
  return check.ok ? 'responded' : check.reason || 'blocked';
}

function formatCheckedAt(value: string | undefined) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function compactHomePath(value: string | null | undefined) {
  if (!value) return 'pending';
  return value.replace(/^\/Users\/[^/]+/, '~');
}

function getShellLabel(value: string | null | undefined) {
  if (!value) return 'shell pending';
  const segments = value.split('/').filter(Boolean);
  return segments.at(-1) || value;
}

function getClaudeLabel(value: string | null | undefined) {
  if (!value) return 'Claude pending';
  const extensionMatch = value.match(/anthropic\.claude-code-([^/]+)/);
  if (extensionMatch) {
    return extensionMatch[1].replace(
      /-darwin-arm64|-darwin-x64|-linux-arm64|-linux-x64/g,
      '',
    );
  }

  const segments = value.split('/').filter(Boolean);
  return segments.at(-1) || value;
}

export function ClaudeCodeWorkspace({
  terminalId,
  onBackToTerminal,
}: ClaudeCodeWorkspaceProps) {
  const { token } = useAuthStore();
  const { showConfirm } = useModalStore();
  const storageKey = getTerminalSessionStorageKey(terminalId);
  const [composer, setComposer] = useState('');
  const [activePanel, setActivePanel] = useState<WorkspacePanel | null>(null);
  const [resumeHint, setResumeHint] = useState<string | null>(null);
  const [claudeState, setClaudeState] = useState<
    'idle' | 'starting' | 'running'
  >('idle');
  const [startupIssue, setStartupIssue] = useState<string | null>(null);
  const autoBootRequestedRef = useRef(false);
  const bootWatchdogRef = useRef<number | null>(null);
  const pendingPromptRef = useRef<string | null>(null);
  const workspaceFiles = useWorkspaceFileEditor();

  const {
    session,
    getSavedSessionId,
    handleSessionReady,
    setConnected,
    updateCommandCount,
    clearSession,
  } = useTerminalSession(storageKey);

  const { terminalRef, xterm } = useTerminalSetup({
    onData: (data) => socket.sendInput(data),
    onResize: (cols, rows) => socket.resize(cols, rows),
    onInterrupt: () => socket.interrupt(),
  });

  const {
    report: diagnosticsReport,
    isLoading: isDiagnosticsLoading,
    error: diagnosticsError,
    runDiagnostics,
  } = useClaudeRuntimeDiagnostics({
    enabled: session.isConnected && Boolean(session.sessionId),
  });

  const runTerminalCommand = useCallback((command: string) => {
    const normalized = command.endsWith('\n') ? command : `${command}\n`;
    socket.sendInput(normalized);
  }, []);

  const bootClaude = useCallback(() => {
    if (claudeState === 'starting' || claudeState === 'running') return;
    setClaudeState('starting');
    setStartupIssue(null);
    setResumeHint(null);

    if (bootWatchdogRef.current) {
      window.clearTimeout(bootWatchdogRef.current);
    }

    bootWatchdogRef.current = window.setTimeout(() => {
      setStartupIssue(
        'Claude CLI가 15초 안에 아무 출력도 주지 않았습니다. 워크스페이스 안에서 `pnpm test:claude-smoke`를 실행해 로컬 Claude 상태를 먼저 확인해보세요.',
      );
    }, 15_000);

    runTerminalCommand(session.claudeLaunchCommand || 'claude');
  }, [claudeState, runTerminalCommand, session.claudeLaunchCommand]);

  const scheduleClaudePrompt = useCallback(
    (prompt: string) => {
      const text = prompt.trim();
      if (!text) return;

      if (claudeState === 'idle' || claudeState === 'starting') {
        pendingPromptRef.current = text;
        bootClaude();
        return;
      }

      runTerminalCommand(text);
      setClaudeState('running');
      setResumeHint(null);
    },
    [bootClaude, claudeState, runTerminalCommand],
  );

  const handleWorkspaceSessionReady = useCallback(
    (data: {
      sessionId: string;
      isReconnect: boolean;
      workingDirectory?: string | null;
      shellPath?: string | null;
      claudeBinaryPath?: string | null;
      claudeLaunchCommand?: string | null;
    }) => {
      const isReconnect = handleSessionReady(data);
      if (!isReconnect) {
        autoBootRequestedRef.current = true;
        setResumeHint(null);
      } else {
        setClaudeState('idle');
        setStartupIssue(null);
        setResumeHint(
          '이전 쉘 세션에 다시 붙었습니다. Claude가 이미 떠 있으면 바로 입력하고, 아니라면 Claude 시작으로 새로 띄우세요.',
        );
      }
      return isReconnect;
    },
    [handleSessionReady],
  );

  const socket = useTerminalSocket({
    token,
    xterm,
    savedSessionId: getSavedSessionId(),
    onSessionReady: handleWorkspaceSessionReady,
    onConnected: () => setConnected(true),
    onDisconnected: () => setConnected(false),
    onCommandCount: updateCommandCount,
    onOutput: (content) => {
      workspaceFiles.registerOutput(content);
      if (claudeState === 'starting' && content.trim()) {
        setClaudeState('running');
        setStartupIssue(null);
        setResumeHint(null);
        if (pendingPromptRef.current) {
          const nextPrompt = pendingPromptRef.current;
          pendingPromptRef.current = null;
          window.setTimeout(() => {
            runTerminalCommand(nextPrompt);
          }, 120);
        }
      }

      if (content.trim() && bootWatchdogRef.current) {
        window.clearTimeout(bootWatchdogRef.current);
        bootWatchdogRef.current = null;
      }
    },
    onSessionClosed: () => {
      clearSession();
      window.location.reload();
    },
  });

  useEffect(() => {
    if (
      !session.isConnected ||
      !session.sessionId ||
      !autoBootRequestedRef.current ||
      (!diagnosticsReport && !diagnosticsError) ||
      isDiagnosticsLoading
    ) {
      return;
    }

    if (diagnosticsError) {
      autoBootRequestedRef.current = false;
      setStartupIssue(
        'Claude 런타임 진단을 자동으로 불러오지 못했습니다. 우측 패널에서 진단을 다시 실행하거나 직접 시작해보세요.',
      );
      return;
    }

    if (diagnosticsReport && !diagnosticsReport.ok) {
      autoBootRequestedRef.current = false;
      setStartupIssue(diagnosticsReport.summary);
      return;
    }

    autoBootRequestedRef.current = false;
    const timeoutId = window.setTimeout(() => {
      bootClaude();
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [
    bootClaude,
    diagnosticsError,
    diagnosticsReport,
    isDiagnosticsLoading,
    session.isConnected,
    session.sessionId,
  ]);

  useEffect(() => {
    return () => {
      if (bootWatchdogRef.current) {
        window.clearTimeout(bootWatchdogRef.current);
      }
    };
  }, []);

  const handleRefreshDiagnostics = useCallback(async () => {
    const report = await runDiagnostics(true);

    if (report?.ok) {
      setStartupIssue(null);
      return;
    }

    if (report) {
      setStartupIssue(report.summary);
      return;
    }

    setStartupIssue(
      'Claude 런타임 진단을 다시 실행하지 못했습니다. 잠시 후 다시 시도해보세요.',
    );
  }, [runDiagnostics]);

  const handleSendPrompt = useCallback(() => {
    const prompt = composer.trim();
    if (!prompt) return;
    scheduleClaudePrompt(prompt);
    setComposer('');
  }, [composer, scheduleClaudePrompt]);

  const handleComposerKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (
        event.key === 'Enter' &&
        !event.shiftKey &&
        !event.nativeEvent.isComposing
      ) {
        event.preventDefault();
        handleSendPrompt();
      }
    },
    [handleSendPrompt],
  );

  const handleCloseSession = useCallback(() => {
    showConfirm(
      '현재 Claude Code 워크스페이스 세션을 종료하시겠습니까?\n진행 중인 작업이 있다면 중단될 수 있습니다.',
      () => {
        pendingPromptRef.current = null;
        socket.closeSession();
        clearSession();
        window.location.reload();
      },
      '세션 닫기',
    );
  }, [clearSession, showConfirm, socket]);

  const statusLabel = !session.isConnected
    ? 'offline'
    : claudeState === 'starting'
      ? 'booting'
      : claudeState === 'running'
        ? 'live'
        : 'ready';
  const runtimeStatusLabel = isDiagnosticsLoading
    ? 'checking'
    : diagnosticsError
      ? 'unavailable'
      : diagnosticsReport?.ok
        ? 'healthy'
        : diagnosticsReport
          ? 'attention'
          : 'idle';
  const checkedAt = formatCheckedAt(diagnosticsReport?.diagnosedAt);
  const activeWorkspacePath =
    workspaceFiles.activePath ??
    workspaceFiles.activeFile?.absolutePath ??
    null;
  const workspaceLabel = compactHomePath(session.workingDirectory);
  const shellLabel = getShellLabel(session.shellPath);
  const claudeLabel = getClaudeLabel(session.claudeBinaryPath);

  const togglePanel = useCallback((panel: WorkspacePanel) => {
    setActivePanel((current) => (current === panel ? null : panel));
  }, []);

  useEffect(() => {
    if (!activeWorkspacePath) {
      return;
    }

    setActivePanel('files');
  }, [activeWorkspacePath]);

  useEffect(() => {
    window.dispatchEvent(new Event('resize'));
  }, [activePanel]);

  return (
    <div className="h-full bg-[radial-gradient(circle_at_top,rgba(249,115,22,0.14),transparent_26%),linear-gradient(180deg,#020617,#0f172a)] p-2 sm:p-4">
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/80 shadow-[0_24px_80px_rgba(2,6,23,0.55)] backdrop-blur">
        <div className="border-b border-white/8 bg-[linear-gradient(180deg,rgba(2,6,23,0.92),rgba(15,23,42,0.9))] px-4 py-3">
          <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              {onBackToTerminal && (
                <button
                  onClick={onBackToTerminal}
                  className="mt-1 flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 transition hover:border-white/20 hover:text-white"
                >
                  <ArrowLeft size={14} />
                  <span>쉘 터미널</span>
                </button>
              )}

              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-orange-300/20 bg-orange-500/15 text-orange-200">
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">
                      Claude Code Workspace
                    </h2>
                    <p className="text-sm text-slate-400">
                      VSCode 확장처럼 터미널을 메인으로 쓰고, 필요한 도구만
                      옆에서 꺼내 쓰는 화면입니다.
                    </p>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 uppercase tracking-[0.22em] text-slate-300">
                    {statusLabel}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-[11px] text-slate-400">
                    workspace {workspaceLabel}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-[11px] text-slate-400">
                    shell {shellLabel}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-[11px] text-slate-400">
                    claude {claudeLabel}
                  </span>
                  {session.sessionId && (
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-[11px] text-slate-400">
                      session {session.sessionId.slice(0, 12)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 2xl:items-end">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={bootClaude}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:border-orange-300/25 hover:bg-white/10"
                >
                  <Play size={15} />
                  <span>Claude 시작</span>
                </button>
                <button
                  onClick={() => {
                    pendingPromptRef.current = null;
                    socket.interrupt();
                    setClaudeState('idle');
                  }}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:border-rose-300/25 hover:bg-white/10"
                >
                  <Square size={15} />
                  <span>중단</span>
                </button>
                <button
                  onClick={() => {
                    pendingPromptRef.current = null;
                    socket.interrupt();
                    setClaudeState('idle');
                    window.setTimeout(() => bootClaude(), 400);
                  }}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:border-white/20 hover:bg-white/10"
                >
                  <RefreshCw size={15} />
                  <span>재시작</span>
                </button>
                <button
                  onClick={handleCloseSession}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:border-white/20 hover:bg-white/10"
                >
                  <TerminalSquare size={15} />
                  <span>세션 닫기</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => togglePanel('assistant')}
                  aria-label="도우미 패널 열기"
                  className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm transition ${
                    activePanel === 'assistant'
                      ? 'border-orange-300/35 bg-orange-500/10 text-orange-100'
                      : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:text-white'
                  }`}
                >
                  <Wand2 size={14} />
                  <span>도우미</span>
                </button>
                <button
                  onClick={() => togglePanel('runtime')}
                  aria-label="런타임 패널 열기"
                  className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm transition ${
                    activePanel === 'runtime'
                      ? 'border-emerald-300/35 bg-emerald-500/10 text-emerald-100'
                      : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:text-white'
                  }`}
                >
                  <ShieldCheck size={14} />
                  <span>런타임</span>
                </button>
                <button
                  onClick={() => togglePanel('files')}
                  aria-label="파일 패널 열기"
                  className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm transition ${
                    activePanel === 'files'
                      ? 'border-cyan-300/35 bg-cyan-500/10 text-cyan-100'
                      : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:text-white'
                  }`}
                >
                  <FileCode2 size={14} />
                  <span>
                    파일
                    {workspaceFiles.changes.length > 0
                      ? ` ${workspaceFiles.changes.length}`
                      : ''}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="relative flex min-h-0 flex-1">
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            {startupIssue && (
              <div className="mx-4 mt-4 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                {startupIssue}
              </div>
            )}
            {resumeHint && (
              <div className="mx-4 mt-4 rounded-2xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
                {resumeHint}
              </div>
            )}

            <div className="min-h-[420px] flex-1 px-4 pb-4 pt-4">
              <div className="flex h-full min-h-[420px] flex-col overflow-hidden rounded-[26px] border border-white/10 bg-[#0b1120] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                <div className="flex items-center justify-between border-b border-white/8 bg-slate-950/70 px-4 py-2">
                  <div className="flex items-center gap-3 text-xs uppercase tracking-[0.24em] text-slate-500">
                    <span>Claude Terminal</span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 font-mono text-[10px] tracking-[0.2em] text-slate-400">
                      {statusLabel}
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-slate-500">
                    {session.commandLimit !== -1
                      ? `commands ${session.commandCount}/${session.commandLimit}`
                      : 'unlimited'}
                  </span>
                </div>

                <div
                  ref={terminalRef}
                  className="min-h-[340px] flex-1 px-2 py-3 sm:px-4"
                  data-testid="claude-code-terminal"
                />
              </div>
            </div>

            <div className="border-t border-white/8 bg-slate-950/85 px-4 py-3">
              <div className="rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(2,6,23,0.9))] p-3">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-slate-500">
                      <Wand2 size={14} />
                      <span>Composer</span>
                    </div>
                    <textarea
                      value={composer}
                      onChange={(event) => setComposer(event.target.value)}
                      onKeyDown={handleComposerKeyDown}
                      rows={2}
                      placeholder="Claude에게 보낼 요청을 입력하세요. Enter 전송, Shift+Enter 줄바꿈."
                      className="w-full resize-none rounded-2xl border border-white/8 bg-slate-950/80 px-4 py-3 text-sm leading-6 text-white placeholder:text-slate-500 focus:border-orange-300/35 focus:outline-none"
                    />
                  </div>

                  <div className="xl:w-[210px] xl:self-stretch">
                    <button
                      onClick={handleSendPrompt}
                      disabled={!composer.trim()}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 px-4 py-3 text-sm font-medium text-white transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500 xl:h-full"
                    >
                      <Sparkles size={15} />
                      <span>Claude로 보내기</span>
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs leading-5 text-slate-500">
                    quick prompts는 도우미 패널에서 열고, 여기서는 터미널 공간을
                    더 넓게 유지합니다.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {CLAUDE_SHORTCUTS.map((command) => (
                      <button
                        key={command}
                        onClick={() => scheduleClaudePrompt(command)}
                        className="rounded-full border border-white/10 bg-slate-950/80 px-3 py-2 font-mono text-xs text-slate-300 transition hover:border-white/20 hover:text-white"
                      >
                        {command}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {activePanel && (
            <div className="pointer-events-none absolute inset-0 z-20 bg-slate-950/35 backdrop-blur-[2px] xl:bg-transparent xl:backdrop-blur-0">
              <div
                className={`pointer-events-auto absolute inset-x-3 bottom-3 top-3 flex flex-col overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/95 shadow-[0_24px_80px_rgba(2,6,23,0.65)] xl:inset-y-3 xl:right-4 xl:left-auto ${
                  activePanel === 'files'
                    ? 'xl:w-[min(720px,58vw)]'
                    : 'xl:w-[420px]'
                }`}
              >
                <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                      {activePanel === 'assistant'
                        ? 'Command Deck'
                        : activePanel === 'runtime'
                          ? 'Runtime Inspector'
                          : 'Workspace Review'}
                    </p>
                    <p className="mt-1 text-sm text-slate-300">
                      {activePanel === 'assistant'
                        ? '터미널을 깨지 않게 유지하면서 빠른 액션만 보조합니다.'
                        : activePanel === 'runtime'
                          ? '실제 Claude CLI 응답 상태와 바이너리 정보를 확인합니다.'
                          : '파일 트리, diff preview, accept/reject patch를 같이 봅니다.'}
                    </p>
                  </div>

                  <button
                    onClick={() => setActivePanel(null)}
                    className="rounded-full border border-white/10 bg-white/5 p-2 text-slate-400 transition hover:border-white/20 hover:text-white"
                    aria-label="패널 닫기"
                  >
                    <X size={14} />
                  </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                  {activePanel === 'assistant' && (
                    <div className="space-y-5">
                      <section className="rounded-3xl border border-orange-400/15 bg-[linear-gradient(180deg,rgba(249,115,22,0.12),rgba(15,23,42,0.55))] p-4">
                        <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.26em] text-orange-200/80">
                          <Wand2 size={14} />
                          <span>Start Here</span>
                        </div>
                        <p className="text-sm leading-6 text-slate-200">
                          기본은 터미널 전체폭입니다. Claude TUI가 깨질 때는
                          패널을 닫고, 필요할 때만 여기서 프롬프트나 도구를 꺼내
                          쓰면 됩니다.
                        </p>
                      </section>

                      <section className="rounded-3xl border border-white/8 bg-white/5 p-4">
                        <div className="mb-3 text-xs uppercase tracking-[0.22em] text-slate-500">
                          Quick Prompts
                        </div>
                        <div className="space-y-2">
                          {STARTER_PROMPTS.map((prompt) => (
                            <button
                              key={prompt}
                              onClick={() => scheduleClaudePrompt(prompt)}
                              className="w-full rounded-2xl border border-white/8 bg-slate-950/80 px-3 py-3 text-left text-sm text-slate-200 transition hover:border-orange-300/30 hover:bg-slate-900"
                            >
                              {prompt}
                            </button>
                          ))}
                        </div>
                      </section>

                      <section className="rounded-3xl border border-white/8 bg-white/5 p-4">
                        <div className="mb-3 text-xs uppercase tracking-[0.22em] text-slate-500">
                          Claude Shortcuts
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {CLAUDE_SHORTCUTS.map((command) => (
                            <button
                              key={command}
                              onClick={() => scheduleClaudePrompt(command)}
                              className="rounded-full border border-white/10 bg-slate-950/80 px-3 py-2 font-mono text-xs text-slate-300 transition hover:border-white/20 hover:text-white"
                            >
                              {command}
                            </button>
                          ))}
                        </div>
                      </section>
                    </div>
                  )}

                  {activePanel === 'runtime' && (
                    <section
                      className="rounded-3xl border border-white/8 bg-white/5 p-4"
                      data-testid="claude-runtime-check"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-slate-500">
                          {isDiagnosticsLoading ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : diagnosticsReport?.ok ? (
                            <ShieldCheck
                              size={14}
                              className="text-emerald-300"
                            />
                          ) : (
                            <AlertTriangle
                              size={14}
                              className="text-amber-300"
                            />
                          )}
                          <span>Claude Runtime Check</span>
                        </div>
                        <span className="rounded-full border border-white/10 bg-slate-950/80 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-slate-300">
                          {runtimeStatusLabel}
                        </span>
                      </div>

                      <p className="mt-3 text-sm leading-6 text-slate-200">
                        {isDiagnosticsLoading
                          ? 'Claude CLI가 실제로 응답하는지 자동으로 확인하고 있습니다.'
                          : diagnosticsError
                            ? '자동 진단을 불러오지 못했습니다. 다시 실행한 뒤 상태를 확인해보세요.'
                            : diagnosticsReport?.summary ||
                              '세션이 준비되면 Claude 런타임 진단을 자동으로 실행합니다.'}
                      </p>

                      {diagnosticsReport?.recommendation &&
                        !diagnosticsReport.ok && (
                          <p className="mt-3 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-100">
                            {diagnosticsReport.recommendation}
                          </p>
                        )}

                      <div className="mt-4 space-y-2 text-xs text-slate-400">
                        <div className="flex items-center justify-between gap-3">
                          <span>binary</span>
                          <span className="max-w-[220px] break-all font-mono text-[11px] text-right text-slate-300">
                            {diagnosticsReport?.environment.binaryPath ||
                              session.claudeBinaryPath ||
                              'pending'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span>version</span>
                          <span className="max-w-[210px] truncate text-right text-slate-300">
                            {formatCheckLabel(
                              diagnosticsReport?.checks.version,
                            )}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span>interactive</span>
                          <span className="max-w-[210px] truncate text-right text-slate-300">
                            {formatCheckLabel(
                              diagnosticsReport?.checks.interactive,
                            )}
                          </span>
                        </div>
                        {checkedAt && (
                          <div className="flex items-center justify-between gap-3">
                            <span>last checked</span>
                            <span className="text-slate-300">
                              {checkedAt}
                              {diagnosticsReport?.cached ? ' cached' : ''}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          onClick={() => void handleRefreshDiagnostics()}
                          disabled={isDiagnosticsLoading}
                          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-2 text-sm text-slate-200 transition hover:border-white/20 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <RefreshCw
                            size={14}
                            className={
                              isDiagnosticsLoading ? 'animate-spin' : ''
                            }
                          />
                          <span>진단 다시 실행</span>
                        </button>
                        {!diagnosticsReport?.ok && !isDiagnosticsLoading && (
                          <button
                            onClick={bootClaude}
                            className="inline-flex items-center gap-2 rounded-2xl border border-amber-300/20 bg-amber-500/10 px-4 py-2 text-sm text-amber-100 transition hover:border-amber-300/30 hover:bg-amber-500/15"
                          >
                            <Play size={14} />
                            <span>그래도 Claude 시작</span>
                          </button>
                        )}
                      </div>
                    </section>
                  )}

                  {activePanel === 'files' && (
                    <ClaudeWorkspaceFilePanel
                      workingDirectory={session.workingDirectory}
                      gitEnabled={workspaceFiles.gitInfo.enabled}
                      gitBranch={workspaceFiles.gitInfo.branch}
                      shipStatus={workspaceFiles.shipStatus}
                      pathInput={workspaceFiles.pathInput}
                      setPathInput={workspaceFiles.setPathInput}
                      references={workspaceFiles.references}
                      activePath={workspaceFiles.activePath}
                      activeReference={workspaceFiles.activeReference}
                      activeFile={workspaceFiles.activeFile}
                      tree={workspaceFiles.tree}
                      changes={workspaceFiles.changes}
                      diff={workspaceFiles.diff}
                      draft={workspaceFiles.draft}
                      setDraft={workspaceFiles.setDraft}
                      isLoading={workspaceFiles.isLoading}
                      isSaving={workspaceFiles.isSaving}
                      isTreeLoading={workspaceFiles.isTreeLoading}
                      isDiffLoading={workspaceFiles.isDiffLoading}
                      isReviewing={workspaceFiles.isReviewing}
                      reviewingHunk={workspaceFiles.reviewingHunk}
                      isCommitting={workspaceFiles.isCommitting}
                      isPushing={workspaceFiles.isPushing}
                      isCreatingBranch={workspaceFiles.isCreatingBranch}
                      error={workspaceFiles.error}
                      hasUnsavedChanges={workspaceFiles.hasUnsavedChanges}
                      commitMessage={workspaceFiles.commitMessage}
                      setCommitMessage={workspaceFiles.setCommitMessage}
                      branchName={workspaceFiles.branchName}
                      setBranchName={workspaceFiles.setBranchName}
                      draftTitle={workspaceFiles.draftTitle}
                      setDraftTitle={workspaceFiles.setDraftTitle}
                      draftBody={workspaceFiles.draftBody}
                      setDraftBody={workspaceFiles.setDraftBody}
                      onRefreshTree={() => void workspaceFiles.refreshTree()}
                      onOpenManualPath={() =>
                        void workspaceFiles.openManualPath()
                      }
                      onOpenReference={(reference) =>
                        void workspaceFiles.openFile(reference)
                      }
                      onOpenPath={(nextPath) =>
                        void workspaceFiles.openFile(nextPath)
                      }
                      onSave={() => void workspaceFiles.saveFile()}
                      onAcceptDiff={() => void workspaceFiles.acceptDiff()}
                      onRejectDiff={() => void workspaceFiles.rejectDiff()}
                      onAcceptDiffHunk={(hunkIndex) =>
                        void workspaceFiles.acceptDiffHunk(hunkIndex)
                      }
                      onRejectDiffHunk={(hunkIndex) =>
                        void workspaceFiles.rejectDiffHunk(hunkIndex)
                      }
                      onCommit={() => void workspaceFiles.commitChanges()}
                      onCreateBranch={() => void workspaceFiles.createBranch()}
                      onPushBranch={() => void workspaceFiles.pushBranch()}
                    />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
