export type OpenAIProvider = 'api' | 'codex';

export interface OpenAIChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  provider?: OpenAIProvider;
  model?: string;
  timestamp: string;
  isStreaming?: boolean;
}

export interface OpenAIChatSession {
  sessionId: string | null;
  isConnected: boolean;
  isReady: boolean;
  provider: OpenAIProvider;
  model: string;
  apiConfigured: boolean;
  lastError: string | null;
}
