import { ClaudeCodeWorkspace, Terminal } from '@/features/terminal';
import { ClaudeChat, type Tab } from '@/features/claude-chat';
import { OpenAIChat } from '@/features/openai-chat';
import type { WorkspaceTabMode } from '../lib/workspace-tabs.utils';

interface WorkspaceTabContentProps {
  tab: Tab;
  mode?: WorkspaceTabMode;
  onChangeMode: (tabId: string, mode: WorkspaceTabMode) => void;
}

// 탭 종류에 맞는 feature 화면을 렌더링한다.
export function WorkspaceTabContent({
  tab,
  mode,
  onChangeMode,
}: WorkspaceTabContentProps) {
  if (tab.type === 'claude-code') {
    return <ClaudeCodeWorkspace terminalId={tab.id} />;
  }

  if (tab.type === 'openai-chat') {
    return <OpenAIChat tabId={tab.id} />;
  }

  if (tab.type === 'terminal') {
    // 터미널 탭은 Claude 모드로 전환할 수 있다.
    return mode === 'claude' ? (
      <ClaudeCodeWorkspace
        terminalId={tab.id}
        onBackToTerminal={() => onChangeMode(tab.id, 'terminal')}
      />
    ) : (
      <Terminal
        terminalId={tab.id}
        onSwitchToClaude={() => onChangeMode(tab.id, 'claude')}
      />
    );
  }

  return <ClaudeChat tabId={tab.id} />;
}
