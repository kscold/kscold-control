import { MessageCircle, Plus, Sparkles, TerminalSquare, X } from 'lucide-react';
import { ClaudeCodeWorkspace, Terminal } from '../features/terminal/ui';
import { ClaudeChat } from '../features/claude-chat/ui';
import { useClaudeTabs } from '../features/claude-chat/hooks';

export function ClaudePage() {
  const {
    tabs,
    activeTabId,
    setActiveTabId,
    tabModes,
    setTabMode,
    createTab,
    closeTab,
  } = useClaudeTabs();

  return (
    <div className="h-full flex flex-col">
      {/* Tab Bar */}
      <div className="flex items-center gap-1 px-2 bg-gray-900 border-b border-gray-800 overflow-x-auto">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`group flex items-center gap-1.5 px-3 py-2 text-sm cursor-pointer border-b-2 transition-colors whitespace-nowrap ${
              activeTabId === tab.id
                ? tab.type === 'claude-chat'
                  ? 'border-orange-500 text-white bg-gray-800'
                  : tab.type === 'claude-code' || tabModes[tab.id] === 'claude'
                    ? 'border-amber-400 text-white bg-gray-800'
                    : 'border-blue-500 text-white bg-gray-800'
                : 'border-transparent text-gray-400 hover:text-gray-300 hover:bg-gray-800'
            }`}
            onClick={() => setActiveTabId(tab.id)}
          >
            {tab.type === 'claude-code' || tabModes[tab.id] === 'claude' ? (
              <Sparkles size={14} />
            ) : tab.type === 'claude-chat' ? (
              <MessageCircle size={14} />
            ) : (
              <TerminalSquare size={14} />
            )}
            <span>{tab.title}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.id);
              }}
              className="opacity-0 group-hover:opacity-100 hover:bg-gray-700 rounded p-0.5 transition-opacity"
            >
              <X size={14} />
            </button>
          </div>
        ))}

        {/* New Tab Buttons */}
        <div className="flex items-center ml-1 gap-0.5">
          <button
            onClick={() => createTab('claude-code')}
            className="flex items-center gap-1 px-2 py-2 text-xs text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
            title="새 Claude Code"
          >
            <Sparkles size={14} />
            <Plus size={12} />
          </button>
          <button
            onClick={() => createTab('claude-chat')}
            className="flex items-center gap-1 px-2 py-2 text-xs text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
            title="새 Claude Chat"
          >
            <MessageCircle size={14} />
            <Plus size={12} />
          </button>
          <button
            onClick={() => createTab('terminal')}
            className="flex items-center gap-1 px-2 py-2 text-xs text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
            title="새 터미널"
          >
            <TerminalSquare size={14} />
            <Plus size={12} />
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 relative">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`absolute inset-0 ${activeTabId === tab.id ? 'block' : 'hidden'}`}
          >
            {tab.type === 'claude-code' ? (
              <ClaudeCodeWorkspace terminalId={tab.id} />
            ) : tab.type === 'terminal' ? (
              tabModes[tab.id] === 'claude' ? (
                <ClaudeCodeWorkspace
                  terminalId={tab.id}
                  onBackToTerminal={() => setTabMode(tab.id, 'terminal')}
                />
              ) : (
                <Terminal
                  terminalId={tab.id}
                  onSwitchToClaude={() => setTabMode(tab.id, 'claude')}
                />
              )
            ) : (
              <ClaudeChat tabId={tab.id} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
