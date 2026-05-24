import type { ErrorInfo } from 'react';
import { useAuthStore } from '../shared/model/auth.store';
import { API_URL } from './api';

export function reportFrontendError(error: Error, errorInfo?: ErrorInfo): void {
  const token = useAuthStore.getState().token;
  if (!token) return;

  fetch(`${API_URL}/api/logs/frontend-error`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo?.componentStack ?? undefined,
      url: window.location.href,
    }),
    keepalive: true,
  }).catch(() => {});
}
