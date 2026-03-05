export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  tools?: ToolUse[];
  costUsd?: number;
  durationMs?: number;
  timestamp: Date;
  isStreaming?: boolean;
}

export interface ToolUse {
  tool: string;
  input: string;
  status: 'start' | 'end';
}

export interface ClaudeChatSession {
  sessionId: string | null;
  isConnected: boolean;
  totalCostUsd: number;
}
