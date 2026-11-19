import { Terminal } from '@/features/terminal';
import { ClaudeChat, type Tab } from '@/features/claude-chat';
import { OpenAIChat } from '@/features/openai-chat';

interface WorkspaceTabContentProps {
  tab: Tab;
}

// 탭 종류에 맞는 feature 화면을 렌더링한다.
export function WorkspaceTabContent({
  tab,
}: WorkspaceTabContentProps) {
  if (tab.type === 'claude-code') {
    return <Terminal terminalId={tab.id} />;
  }

  if (tab.type === 'openai-chat') {
    return <OpenAIChat tabId={tab.id} />;
  }

  if (tab.type === 'terminal') {
    return <Terminal terminalId={tab.id} />;
  }

  return <ClaudeChat tabId={tab.id} />;
}
