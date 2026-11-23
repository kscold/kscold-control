import { useState } from 'react';
import {
  getClaudeSessionStorageKey,
  getTerminalSessionStorageKey,
  getOpenAISessionStorageKey,
} from '@/shared/lib';

export type TabType =
  'terminal' | 'claude-chat' | 'claude-code' | 'openai-chat';

export interface Tab {
  id: string;
  title: string;
  type: TabType;
  launch?: 'codex' | 'claude';
}

export function useClaudeTabs() {
  const [tabs, setTabs] = useState<Tab[]>([
    { id: 'terminal-1', title: '터미널', type: 'terminal' },
  ]);
  const [activeTabId, setActiveTabId] = useState('terminal-1');
  const [tabModes, setTabModes] = useState<
    Record<string, 'terminal' | 'claude'>
  >({});

  const setTabMode = (tabId: string, mode: 'terminal' | 'claude') =>
    setTabModes((prev) => ({ ...prev, [tabId]: mode }));

  const createTab = (type: TabType, launch?: Tab['launch']) => {
    const newId = `${type}-${crypto.randomUUID()}`;
    const count = tabs.filter((t) => t.type === type).length + 1;
    const title =
      type === 'claude-code'
        ? `Claude Code ${count}`
        : type === 'claude-chat'
          ? `Claude Chat ${count}`
          : type === 'openai-chat'
            ? `OpenAI ${count}`
            : `Terminal ${count}`;
    setTabs((prev) => [
      ...prev,
      {
        id: newId,
        title:
          launch === 'codex' ? 'Codex' : launch === 'claude' ? 'Claude' : title,
        type,
        launch,
      },
    ]);
    setActiveTabId(newId);
  };

  const closeTab = (id: string) => {
    localStorage.removeItem(getClaudeSessionStorageKey(id));
    localStorage.removeItem(getTerminalSessionStorageKey(id));
    localStorage.removeItem(getOpenAISessionStorageKey(`${id}-api`));
    localStorage.removeItem(getOpenAISessionStorageKey(`${id}-codex`));

    const newTabs = tabs.filter((t) => t.id !== id);
    setTabs(newTabs);
    if (activeTabId === id) {
      setActiveTabId(newTabs[0]?.id ?? '');
    }
  };

  return {
    tabs,
    activeTabId,
    setActiveTabId,
    tabModes,
    setTabMode,
    createTab,
    closeTab,
  };
}
