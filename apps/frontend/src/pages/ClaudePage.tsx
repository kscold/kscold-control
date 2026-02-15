import { useState } from 'react';
import { Terminal } from '../features/terminal/ui';
import { Plus, X } from 'lucide-react';
import { useModalStore } from '../stores/modal.store';

interface Terminal {
  id: string;
  title: string;
}

export function ClaudePage() {
  const [terminals, setTerminals] = useState<Terminal[]>([
    { id: '1', title: 'Terminal 1' },
  ]);
  const [activeTerminalId, setActiveTerminalId] = useState('1');
  const { showAlert } = useModalStore();

  const createTerminal = () => {
    const newId = Date.now().toString();
    const newTerminal = {
      id: newId,
      title: `Terminal ${terminals.length + 1}`,
    };
    setTerminals([...terminals, newTerminal]);
    setActiveTerminalId(newId);
  };

  const closeTerminal = (id: string) => {
    if (terminals.length === 1) {
      showAlert('최소 1개의 터미널이 필요합니다');
      return;
    }

    const newTerminals = terminals.filter((t) => t.id !== id);
    setTerminals(newTerminals);

    // 닫은 터미널이 활성 터미널이었으면 다른 터미널로 전환
    if (activeTerminalId === id) {
      setActiveTerminalId(newTerminals[0].id);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-800">
        <h2 className="text-xl font-bold text-white">Terminal</h2>
        <p className="text-sm text-gray-500">Mac Mini 터미널 (zsh 셸)</p>
      </div>

      {/* Terminal Tabs */}
      <div className="flex items-center gap-1 px-4 bg-gray-900 border-b border-gray-800 overflow-x-auto">
        {terminals.map((terminal) => (
          <div
            key={terminal.id}
            className={`group flex items-center gap-2 px-3 py-2 text-sm cursor-pointer border-b-2 transition-colors ${
              activeTerminalId === terminal.id
                ? 'border-blue-500 text-white bg-gray-800'
                : 'border-transparent text-gray-400 hover:text-gray-300 hover:bg-gray-800'
            }`}
            onClick={() => setActiveTerminalId(terminal.id)}
          >
            <span>{terminal.title}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeTerminal(terminal.id);
              }}
              className="opacity-0 group-hover:opacity-100 hover:bg-gray-700 rounded p-0.5 transition-opacity"
            >
              <X size={14} />
            </button>
          </div>
        ))}
        <button
          onClick={createTerminal}
          className="flex items-center gap-1 px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
          title="새 터미널 생성"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Terminal Content */}
      <div className="flex-1 relative">
        {terminals.map((terminal) => (
          <div
            key={terminal.id}
            className={`absolute inset-0 ${
              activeTerminalId === terminal.id ? 'block' : 'hidden'
            }`}
          >
            <Terminal terminalId={terminal.id} />
          </div>
        ))}
      </div>
    </div>
  );
}
