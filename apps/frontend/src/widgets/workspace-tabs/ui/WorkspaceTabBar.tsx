import {
  BotMessageSquare,
  MessageCircle,
  Plus,
  Sparkles,
  TerminalSquare,
  X,
} from 'lucide-react';
import type { Tab, TabType } from '@/features/claude-chat';
import {
  tabAccentClass,
  tabIcon,
  type WorkspaceTabMode,
} from '../lib/workspace-tabs.utils';

interface WorkspaceTabBarProps {
  tabs: Tab[];
  activeTabId: string;
  tabModes: Record<string, WorkspaceTabMode>;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onCreateTab: (type: TabType) => void;
}

export function WorkspaceTabBar({
  tabs,
  activeTabId,
  tabModes,
  onSelectTab,
  onCloseTab,
  onCreateTab,
}: WorkspaceTabBarProps) {
  return (
    <div className="flex items-center gap-1 px-2 bg-gray-900 border-b border-gray-800 overflow-x-auto">
      {tabs.map((tab) => {
        const mode = tabModes[tab.id];
        const isActive = activeTabId === tab.id;
        return (
          <div
            key={tab.id}
            className={`group flex items-center gap-1.5 px-3 py-2 text-sm cursor-pointer border-b-2 transition-colors whitespace-nowrap ${
              isActive
                ? tabAccentClass(tab.type, mode)
                : 'border-transparent text-gray-400 hover:text-gray-300 hover:bg-gray-800'
            }`}
            onClick={() => onSelectTab(tab.id)}
          >
            {tabIcon(tab.type, mode)}
            <span>{tab.title}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCloseTab(tab.id);
              }}
              className="opacity-0 group-hover:opacity-100 hover:bg-gray-700 rounded p-0.5 transition-opacity"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}

      {/* 새 탭 생성 버튼 */}
      <div className="flex items-center ml-1 gap-0.5">
        <button
          onClick={() => onCreateTab('claude-code')}
          className="flex items-center gap-1 px-2 py-2 text-xs text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
          title="새 Claude Code"
        >
          <Sparkles size={14} />
          <Plus size={12} />
        </button>
        <button
          onClick={() => onCreateTab('claude-chat')}
          className="flex items-center gap-1 px-2 py-2 text-xs text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
          title="새 Claude Chat"
        >
          <MessageCircle size={14} />
          <Plus size={12} />
        </button>
        <button
          onClick={() => onCreateTab('openai-chat')}
          className="flex items-center gap-1 px-2 py-2 text-xs text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
          title="새 OpenAI (Chat API / Codex)"
        >
          <BotMessageSquare size={14} />
          <Plus size={12} />
        </button>
        <button
          onClick={() => onCreateTab('terminal')}
          className="flex items-center gap-1 px-2 py-2 text-xs text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
          title="새 터미널"
        >
          <TerminalSquare size={14} />
          <Plus size={12} />
        </button>
      </div>
    </div>
  );
}
