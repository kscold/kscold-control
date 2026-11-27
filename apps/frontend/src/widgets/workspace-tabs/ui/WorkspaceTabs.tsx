import { useState } from 'react';
import { useClaudeTabs } from '@/features/claude-chat';
import { LiveSessionsDialog } from '@/features/terminal';
import { WorkspaceTabBar } from './WorkspaceTabBar';
import { WorkspaceTabContent } from './WorkspaceTabContent';

// 터미널 / Claude Code / Claude Chat / OpenAI 를 탭으로 묶어주는 작업 공간 위젯
export function WorkspaceTabs() {
  const {
    tabs,
    activeTabId,
    setActiveTabId,
    tabModes,
    createTab,
    closeTab,
    attachTerminal,
    openTerminalSessionIds,
  } = useClaudeTabs();
  const [attaching, setAttaching] = useState(false);

  return (
    <div className="h-full flex flex-col">
      <WorkspaceTabBar
        tabs={tabs}
        activeTabId={activeTabId}
        tabModes={tabModes}
        onSelectTab={setActiveTabId}
        onCloseTab={closeTab}
        onCreateTab={createTab}
        onAttach={() => setAttaching(true)}
      />
      <LiveSessionsDialog
        open={attaching}
        openSessionIds={attaching ? openTerminalSessionIds() : []}
        onClose={() => setAttaching(false)}
        onPick={(session) => {
          attachTerminal(session.id, session.title || '이어 붙인 터미널');
          setAttaching(false);
        }}
      />

      {/* 탭은 언마운트하지 않고 숨겨서 세션 상태를 유지한다 */}
      <div className="flex-1 relative">
        {tabs.length === 0 && (
          <div className="absolute inset-0 grid place-content-center gap-3 text-center">
            <p className="text-sm text-gray-400">열린 탭이 없습니다.</p>
            <button
              className="rounded-lg bg-blue-700 px-4 py-2 text-white"
              onClick={() => createTab('terminal')}
            >
              새 터미널
            </button>
          </div>
        )}
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`absolute inset-0 ${activeTabId === tab.id ? 'block' : 'hidden'}`}
          >
            <WorkspaceTabContent
              tab={tab}
              onLaunch={(agent) => createTab('terminal', agent)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
