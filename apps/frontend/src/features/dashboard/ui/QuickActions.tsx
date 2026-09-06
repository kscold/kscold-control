import { useNavigate } from 'react-router-dom';
import { Terminal, Container, KeyRound } from 'lucide-react';
import { PERMISSIONS } from '@/shared/config/permissions';
import { useAuthStore } from '@/shared/model';

export function QuickActions() {
  const navigate = useNavigate();
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const actions = [
    {
      permission: PERMISSIONS.SECRETS_READ,
      to: '/keys',
      icon: KeyRound,
      iconClassName: 'text-amber-300',
      title: '운영 키 관리',
      description: 'GoLe · Pawpong 환경 변수와 안전 배포',
    },
    {
      permission: PERMISSIONS.TERMINAL_ACCESS,
      to: '/terminal',
      icon: Terminal,
      iconClassName: 'text-blue-400',
      title: 'Terminal',
      description: 'Mac Mini 터미널 접속',
    },
    {
      permission: PERMISSIONS.DOCKER_READ,
      to: '/docker',
      icon: Container,
      iconClassName: 'text-green-400',
      title: 'Docker Manager',
      description: 'Create and manage containers',
    },
  ].filter((action) => permissions.includes(action.permission));

  if (actions.length === 0) return null;

  return (
    <>
      <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">
        Quick Actions
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pb-6">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.to}
              type="button"
              onClick={() => navigate(action.to)}
              className="flex items-center gap-3 rounded-xl border border-gray-800 bg-gray-900 p-4 transition hover:border-blue-600 active:scale-95 sm:gap-4 sm:p-5"
            >
              <Icon
                size={28}
                className={`${action.iconClassName} flex-shrink-0`}
              />
              <div className="min-w-0 text-left">
                <p className="text-sm font-semibold text-white sm:text-base">
                  {action.title}
                </p>
                <p className="truncate text-xs text-gray-500 sm:text-sm">
                  {action.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}
