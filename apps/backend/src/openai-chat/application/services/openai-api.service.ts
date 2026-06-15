import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';

export interface OpenAIStreamEvent {
  type: 'text-delta' | 'message-end' | 'error' | 'done';
  text?: string;
  content?: string;
  model?: string;
  message?: string;
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

@Injectable()
export class OpenAIApiService {
  private readonly logger = new Logger(OpenAIApiService.name);
  private readonly histories = new Map<string, ConversationMessage[]>();
  private readonly abortControllers = new Map<string, AbortController>();
  private client: OpenAI | null = null;

  private getClient(): OpenAI {
    if (!this.client) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');
      this.client = new OpenAI({ apiKey });
    }
    return this.client;
  }

  getModel(): string {
    return process.env.OPENAI_MODEL || 'gpt-4o';
  }

  getHistory(sessionId: string): ConversationMessage[] {
    return this.histories.get(sessionId) ?? [];
  }

  clearHistory(sessionId: string): void {
    this.histories.delete(sessionId);
  }

  isApiKeyConfigured(): boolean {
    return !!process.env.OPENAI_API_KEY;
  }

  async sendMessage(
    sessionId: string,
    userMessage: string,
    onEvent: (event: OpenAIStreamEvent) => void,
  ): Promise<void> {
    const history = this.histories.get(sessionId) ?? [];
    history.push({ role: 'user', content: userMessage });
    this.histories.set(sessionId, history);

    const controller = new AbortController();
    this.abortControllers.set(sessionId, controller);

    let fullContent = '';

    try {
      const client = this.getClient();
      const model = this.getModel();

      const stream = await client.chat.completions.create(
        {
          model,
          messages: history,
          stream: true,
        },
        { signal: controller.signal },
      );

      for await (const chunk of stream) {
        if (controller.signal.aborted) break;
        const delta = chunk.choices[0]?.delta?.content ?? '';
        if (delta) {
          fullContent += delta;
          onEvent({ type: 'text-delta', text: delta });
        }
      }

      history.push({ role: 'assistant', content: fullContent });
      this.histories.set(sessionId, history);

      onEvent({ type: 'message-end', content: fullContent, model });
    } catch (err: any) {
      // openai SDK는 AbortError 대신 APIUserAbortError를 던지므로 메시지로 감지
      const isAbort =
        err.name === 'AbortError' ||
        err.constructor?.name === 'APIUserAbortError' ||
        controller.signal.aborted;

      if (isAbort) {
        onEvent({
          type: 'message-end',
          content: fullContent,
          model: this.getModel(),
        });
      } else {
        this.logger.error(`[OpenAI API] ${err.message}`);
        onEvent({ type: 'error', message: err.message });
      }
    } finally {
      this.abortControllers.delete(sessionId);
      onEvent({ type: 'done' });
    }
  }

  abort(sessionId: string): void {
    this.abortControllers.get(sessionId)?.abort();
    this.abortControllers.delete(sessionId);
  }
}
