import { useState } from 'react';
import { Terminal } from '../features/terminal/ui';
import { ClaudeChat } from '../features/claude-chat/ui/ClaudeChat';
import { Plus, X, TerminalSquare, MessageCircle } from 'lucide-react';
import { useModalStore } from '../stores/modal.store';

type TabType = 'terminal' | 'claude-chat';

interface Tab {
  id: string;
  title: string;
  type: TabType;
}

export function ClaudePage() {
  const [tabs, setTabs] = useState<Tab[]>([
    { id: 'chat-1', title: 'Claude Chat', type: 'claude-chat' },
  ]);
  const [activeTabId, setActiveTabId] = useState('chat-1');
  const { showAlert } = useModalStore();

  const createTab = (type: TabType) => {
    const newId = `${type}-${Date.now()}`;
    const count = tabs.filter((t) => t.type === type).length + 1;
    const title =
      type === 'claude-chat' ? `Claude Chat ${count}` : `Terminal ${count}`;
    setTabs([...tabs, { id: newId, title, type }]);
    setActiveTabId(newId);
  };

  const closeTab = (id: string) => {
    if (tabs.length === 1) {
      showAlert('최소 1개의 탭이 필요합니다');
      return;
    }

    const newTabs = tabs.filter((t) => t.id !== id);
    setTabs(newTabs);

    if (activeTabId === id) {
      setActiveTabId(newTabs[0].id);
    }
  };

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
                  : 'border-blue-500 text-white bg-gray-800'
                : 'border-transparent text-gray-400 hover:text-gray-300 hover:bg-gray-800'
            }`}
            onClick={() => setActiveTabId(tab.id)}
          >
            {tab.type === 'claude-chat' ? (
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
            className={`absolute inset-0 ${
              activeTabId === tab.id ? 'block' : 'hidden'
            }`}
          >
            {tab.type === 'terminal' ? (
              <Terminal terminalId={tab.id} />
            ) : (
              <ClaudeChat />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
