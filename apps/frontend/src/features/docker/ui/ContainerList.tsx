import { useState } from 'react';
import { Activity, Layers, RotateCw } from 'lucide-react';
import { useModalStore, usePermissions } from '@/shared/model';
import { PERMISSIONS } from '@/shared/config/permissions';
import type { Container } from '@/entities/container';
import { containerOpsService } from '../api/container-ops.service';
import { ContainerCard } from './ContainerCard';

interface ContainerListProps {
  containers: Container[];
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onDelete: (container: Container) => void;
  onImport?: (dockerId: string) => void;
}

const STANDALONE = '단독 컨테이너';

/** compose 스택(project)별로 묶는다. 스택 없는 컨테이너는 맨 뒤에 모은다 */
function groupByStack(containers: Container[]) {
  const groups = new Map<string, Container[]>();
  for (const container of containers) {
    const key = container.composeProject || STANDALONE;
    groups.set(key, [...(groups.get(key) ?? []), container]);
  }
  return [...groups.entries()].sort(([a], [b]) =>
    a === STANDALONE ? 1 : b === STANDALONE ? -1 : a.localeCompare(b),
  );
}

/**
 * 컨테이너 카드를 스택별로 묶어 보여준다 (Dockge 처럼 스택 단위로 다시 켤 수 있음)
 */
export function ContainerList({
  containers,
  onStart,
  onStop,
  onDelete,
  onImport,
}: ContainerListProps) {
  const { hasPermission } = usePermissions();
  const { showConfirm, showAlert } = useModalStore();
  const [busyStack, setBusyStack] = useState<string | null>(null);

  if (containers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 text-gray-500 py-12">
        <Activity size={48} className="mb-4" />
        <p className="text-center px-4">
          아직 컨테이너가 없습니다. Ubuntu를 생성하여 시작하세요!
        </p>
      </div>
    );
  }

  const groups = groupByStack(containers);
  const showHeaders = groups.length > 1 || groups[0][0] !== STANDALONE;

  const restartStack = (project: string, count: number) =>
    showConfirm(
      `${project} 스택의 컨테이너 ${count}개를 차례로 재시작할까요?`,
      async () => {
        setBusyStack(project);
        try {
          const names = await containerOpsService.restartStack(project);
          showAlert(`${names.join(', ')} 를 재시작했습니다.`);
        } catch (e) {
          showAlert(
            e instanceof Error ? e.message : '재시작하지 못했습니다.',
            '스택 재시작 실패',
          );
        } finally {
          setBusyStack(null);
        }
      },
      '스택 재시작',
    );

  return (
    <div className="space-y-6">
      {groups.map(([stack, members]) => {
        const running = members.filter(
          (c) => c.liveStatus === 'running',
        ).length;
        return (
          <section key={stack}>
            {showHeaders && (
              <div className="mb-2 flex items-center gap-2">
                <Layers size={16} className="shrink-0 text-gray-400" />
                <h3 className="min-w-0 truncate text-sm font-semibold text-gray-200">
                  {stack}
                </h3>
                <span
                  className={`shrink-0 text-xs ${running === members.length ? 'text-emerald-400' : 'text-amber-300'}`}
                >
                  {running}/{members.length} 실행 중
                </span>
                {stack !== STANDALONE &&
                  hasPermission(PERMISSIONS.DOCKER_UPDATE) && (
                    <button
                      type="button"
                      onClick={() => restartStack(stack, members.length)}
                      disabled={busyStack === stack}
                      className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-md border border-gray-700 px-2 py-1 text-xs text-gray-300 hover:text-white disabled:opacity-50"
                    >
                      <RotateCw
                        size={12}
                        className={busyStack === stack ? 'animate-spin' : ''}
                      />
                      스택 재시작
                    </button>
                  )}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {members.map((container) => (
                <ContainerCard
                  key={container.id}
                  container={container}
                  onStart={onStart}
                  onStop={onStop}
                  onDelete={onDelete}
                  onImport={onImport}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
