import { CalendarClock, FolderX, HardDrive } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import {
  AutomationsView,
  StorageOverviewView,
  WorktreeCleanupView,
} from '@/features/maintenance';

const TABS = [
  { key: 'storage', label: '저장공간 현황', icon: HardDrive },
  { key: 'automations', label: '자동 작업', icon: CalendarClock },
  { key: 'worktrees', label: '작업 폴더 정리', icon: FolderX },
] as const;

type TabKey = (typeof TABS)[number]['key'];

/** 저장공간 화면 — 현황, 자동 작업, 작업 폴더 정리를 탭으로 나눠 보여준다 */
export function MaintenancePage() {
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab');
  const active: TabKey =
    TABS.find((tab) => tab.key === requested)?.key ?? 'storage';

  return (
    <div className="h-full overflow-auto bg-gray-950 p-4 sm:p-6">
      <div
        role="tablist"
        aria-label="저장공간 메뉴"
        className="mb-6 flex gap-1 border-b border-gray-800"
      >
        {TABS.map((tab) => {
          const selected = tab.key === active;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() =>
                setParams(tab.key === 'storage' ? {} : { tab: tab.key }, {
                  replace: true,
                })
              }
              className={`-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm transition-colors ${selected ? 'border-sky-400 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </div>
      {active === 'storage' && <StorageOverviewView />}
      {active === 'automations' && <AutomationsView />}
      {active === 'worktrees' && <WorktreeCleanupView />}
    </div>
  );
}
