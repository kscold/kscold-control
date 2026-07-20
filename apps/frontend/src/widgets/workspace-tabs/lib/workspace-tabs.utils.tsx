import {
  BotMessageSquare,
  MessageCircle,
  Sparkles,
  TerminalSquare,
} from 'lucide-react';
import type { TabType } from '@/features/claude-chat';

// 터미널 탭이 Claude 모드로 전환됐는지를 나타내는 값
export type WorkspaceTabMode = 'terminal' | 'claude';

// 탭 종류(와 터미널 탭의 현재 모드)에 맞는 아이콘을 반환한다.
export function tabIcon(type: TabType, mode?: WorkspaceTabMode) {
  if (type === 'claude-code' || mode === 'claude')
    return <Sparkles size={14} />;
  if (type === 'claude-chat') return <MessageCircle size={14} />;
  if (type === 'openai-chat') return <BotMessageSquare size={14} />;
  return <TerminalSquare size={14} />;
}

// 활성 탭에 적용할 강조 색상 클래스를 반환한다.
export function tabAccentClass(type: TabType, mode?: WorkspaceTabMode) {
  if (type === 'openai-chat') return 'border-green-500 text-white bg-gray-800';
  if (type === 'claude-code' || mode === 'claude')
    return 'border-amber-400 text-white bg-gray-800';
  if (type === 'claude-chat') return 'border-orange-500 text-white bg-gray-800';
  return 'border-blue-500 text-white bg-gray-800';
}
