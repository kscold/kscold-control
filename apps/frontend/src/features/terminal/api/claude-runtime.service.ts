import { api } from '@/shared/api/client';
import type { ClaudeRuntimeDiagnostics } from '../model/terminal.types';

export const claudeRuntimeService = {
  async getDiagnostics(
    forceRefresh = false,
  ): Promise<ClaudeRuntimeDiagnostics> {
    const { data } = await api.get<ClaudeRuntimeDiagnostics>(
      '/claude-chat/diagnostics',
      {
        params: forceRefresh ? { refresh: '1' } : undefined,
      },
    );
    return data;
  },
};
