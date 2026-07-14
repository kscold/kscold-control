import { useState } from 'react';
import { useModalStore } from '@/shared/model';
import {
  getClaudeSessionStorageKey,
  getTerminalSessionStorageKey,
  getOpenAISessionStorageKey,
} from '@/shared/lib';

export type TabType =
  | 'terminal'
  | 'claude-chat'
  | 'claude-code'
  | 'openai-chat';

export interface Tab {
  id: string;
  title: string;
  type: TabType;
}

export function useClaudeTabs() {
  const [tabs, setTabs] = useState<Tab[]>([
    { id: 'claude-code-1', title: 'Claude Code', type: 'claude-code' },
  ]);
  const [activeTabId, setActiveTabId] = useState('claude-code-1');
  const [tabModes, setTabModes] = useState<
    Record<string, 'terminal' | 'claude'>
  >({});
  const { showAlert } = useModalStore();

  const setTabMode = (tabId: string, mode: 'terminal' | 'claude') =>
    setTabModes((prev) => ({ ...prev, [tabId]: mode }));

  const createTab = (type: TabType) => {
    const newId = `${type}-${Date.now()}`;
    const count = tabs.filter((t) => t.type === type).length + 1;
    const title =
      type === 'claude-code'
        ? `Claude Code ${count}`
        : type === 'claude-chat'
          ? `Claude Chat ${count}`
          : type === 'openai-chat'
            ? `OpenAI ${count}`
            : `Terminal ${count}`;
    setTabs((prev) => [...prev, { id: newId, title, type }]);
    setActiveTabId(newId);
  };

  const closeTab = (id: string) => {
    if (tabs.length === 1) {
      showAlert('최소 1개의 탭이 필요합니다');
      return;
    }

    localStorage.removeItem(getClaudeSessionStorageKey(id));
    localStorage.removeItem(getTerminalSessionStorageKey(id));
    localStorage.removeItem(getOpenAISessionStorageKey(`${id}-api`));
    localStorage.removeItem(getOpenAISessionStorageKey(`${id}-codex`));

    const newTabs = tabs.filter((t) => t.id !== id);
    setTabs(newTabs);
    if (activeTabId === id) {
      setActiveTabId(newTabs[0].id);
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
