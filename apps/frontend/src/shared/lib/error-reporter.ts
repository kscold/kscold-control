import { useAuthStore } from '../model/auth.store';
import { API_URL } from '../config';
import {
  frontendDiagnostic,
  type DiagnosticContext,
} from './frontend-diagnostic';

const recent = new Map<string, number>();
let windowStart = 0;
let sent = 0;

export function reportFrontendError(
  error: unknown,
  context?: DiagnosticContext,
): void {
  try {
    const token = useAuthStore.getState().token;
    if (!token) return;
    const now = Date.now();
    if (now - windowStart >= 60_000) {
      windowStart = now;
      sent = 0;
      recent.clear();
    }
    const diagnostic = frontendDiagnostic(error, context);
    // 배치 번호별로 중복을 우회하지 못하게 동일 단계·원인은 하나로 묶음.
    const key = JSON.stringify({ ...diagnostic, batchIndex: undefined });
    if (sent >= 20 || now - (recent.get(key) ?? -Infinity) < 10_000) return;
    recent.set(key, now);
    sent += 1;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);
    try {
      void fetch(`${API_URL}/api/logs/frontend-error`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(diagnostic),
        keepalive: true,
        signal: controller.signal,
      })
        .catch(() => {})
        .finally(() => clearTimeout(timeout));
    } catch {
      clearTimeout(timeout);
    }
  } catch {
    // 오류 수집 실패가 원래 동작이나 인증 상태를 변경해서는 안 됨.
  }
}

export function installGlobalErrorReporting(): () => void {
  const onError = (event: Event) => {
    if (event instanceof ErrorEvent) {
      reportFrontendError(event.error, { kind: 'runtime' });
    } else if (
      event.target instanceof HTMLScriptElement ||
      (event.target instanceof HTMLLinkElement &&
        event.target.rel === 'stylesheet')
    ) {
      reportFrontendError(undefined, { kind: 'resource' });
    }
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    reportFrontendError(event.reason, { kind: 'unhandled-rejection' });
  };
  const onPreloadError = () => {
    reportFrontendError(new Error('Unable to preload CSS'), {
      kind: 'resource',
    });
  };
  window.addEventListener('error', onError, true);
  window.addEventListener('unhandledrejection', onRejection);
  window.addEventListener('vite:preloadError', onPreloadError);
  return () => {
    window.removeEventListener('error', onError, true);
    window.removeEventListener('unhandledrejection', onRejection);
    window.removeEventListener('vite:preloadError', onPreloadError);
  };
}
