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

  /**
   * 살아 있는 터미널 세션에 새 탭으로 붙는다. 이미 붙은 탭이 있으면 그 탭을 연다.
   * 탭이 그려지기 전에 세션 ID 를 저장해 두면 터미널이 새로 만들지 않고 그 세션으로 연결한다.
   */
  const attachTerminal = (sessionId: string, title: string) => {
    const existing = tabs.find(
      (tab) =>
        tab.type === 'terminal' &&
        localStorage.getItem(getTerminalSessionStorageKey(tab.id)) ===
          sessionId,
    );
    if (existing) {
      setActiveTabId(existing.id);
      return;
    }
    const newId = `terminal-${crypto.randomUUID()}`;
    localStorage.setItem(getTerminalSessionStorageKey(newId), sessionId);
    setTabs((prev) => [...prev, { id: newId, title, type: 'terminal' }]);
    setActiveTabId(newId);
  };

  /** 이 화면 탭들이 붙어 있는 터미널 세션 */
  const openTerminalSessionIds = () =>
    tabs
      .filter((tab) => tab.type === 'terminal')
      .map((tab) => localStorage.getItem(getTerminalSessionStorageKey(tab.id)))
      .filter((id): id is string => Boolean(id));

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
    attachTerminal,
    openTerminalSessionIds,
    closeTab,
  };
}
