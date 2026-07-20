import { useClaudeTabs } from '@/features/claude-chat';
import { WorkspaceTabBar } from './WorkspaceTabBar';
import { WorkspaceTabContent } from './WorkspaceTabContent';

// 터미널 / Claude Code / Claude Chat / OpenAI 를 탭으로 묶어주는 작업 공간 위젯
export function WorkspaceTabs() {
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
      <WorkspaceTabBar
        tabs={tabs}
        activeTabId={activeTabId}
        tabModes={tabModes}
        onSelectTab={setActiveTabId}
        onCloseTab={closeTab}
        onCreateTab={createTab}
      />

      {/* 탭은 언마운트하지 않고 숨겨서 세션 상태를 유지한다 */}
      <div className="flex-1 relative">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`absolute inset-0 ${activeTabId === tab.id ? 'block' : 'hidden'}`}
          >
            <WorkspaceTabContent
              tab={tab}
              mode={tabModes[tab.id]}
              onChangeMode={setTabMode}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
