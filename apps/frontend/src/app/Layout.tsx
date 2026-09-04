import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Container,
  FileText,
  FolderGit2,
  GitBranch,
  Globe,
  History,
  Eye,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Network,
  Shield,
  ShieldAlert,
  Terminal,
  Undo2,
  X,
} from 'lucide-react';
import { PERMISSIONS } from '@/shared/config/permissions';
import { useAuthStore } from '@/shared/model';

const NAV_ITEMS = [
  {
    to: '/',
    end: true,
    label: '대시보드',
    icon: LayoutDashboard,
    permission: PERMISSIONS.DASHBOARD_READ,
  },
  {
    to: '/keys',
    label: '운영 키',
    icon: KeyRound,
    permission: PERMISSIONS.SECRETS_READ,
  },
  {
    to: '/terminal',
    label: '터미널',
    icon: Terminal,
    permission: PERMISSIONS.TERMINAL_ACCESS,
  },
  {
    to: '/docker',
    label: 'Docker 관리',
    icon: Container,
    permission: PERMISSIONS.DOCKER_READ,
  },
  {
    to: '/rbac',
    label: '권한 관리',
    icon: Shield,
    permission: PERMISSIONS.RBAC_MANAGE,
  },
  {
    to: '/logs',
    label: '시스템 로그',
    icon: FileText,
    permission: PERMISSIONS.SYSTEM_READ,
  },
  {
    to: '/nginx',
    label: 'Nginx 설정',
    icon: Globe,
    permission: PERMISSIONS.SYSTEM_READ,
  },
  {
    to: '/network',
    label: '네트워크',
    icon: Network,
    permission: PERMISSIONS.SYSTEM_READ,
  },
  {
    to: '/topology',
    label: '토폴로지',
    icon: GitBranch,
    permission: PERMISSIONS.DOCKER_READ,
  },
  {
    to: '/repository',
    label: '소스 저장소',
    icon: FolderGit2,
    permission: PERMISSIONS.REPOSITORY_READ,
  },
  {
    to: '/audit',
    label: '운영 감사',
    icon: History,
    permission: PERMISSIONS.SYSTEM_READ,
  },
  {
    to: '/security',
    label: 'IP 차단',
    icon: ShieldAlert,
    permission: PERMISSIONS.SECURITY_READ,
  },
] as const;

export function Layout() {
  const { user, logout, impersonation, endImpersonation } = useAuthStore();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const permissions = new Set(user?.permissions ?? []);
  const visibleItems = NAV_ITEMS.filter((item) =>
    permissions.has(item.permission),
  );

  useEffect(() => {
    if (!impersonation) {
      setRemainingSeconds(0);
      return;
    }

    const tick = () => {
      const remaining = Math.max(
        0,
        Math.ceil((Date.parse(impersonation.expiresAt) - Date.now()) / 1000),
      );
      setRemainingSeconds(remaining);
      if (remaining === 0 && endImpersonation()) {
        navigate('/rbac', { replace: true });
      }
    };

    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [endImpersonation, impersonation, navigate]);

  const returnToAdmin = () => {
    if (endImpersonation()) navigate('/rbac', { replace: true });
  };

  const remainingLabel = `${Math.floor(remainingSeconds / 60)}:${String(
    remainingSeconds % 60,
  ).padStart(2, '0')}`;

  const navLinks = visibleItems.map((item) => {
    const Icon = item.icon;
    return (
      <NavLink
        key={item.to}
        to={item.to}
        end={'end' in item ? item.end : undefined}
        onClick={() => setIsMobileMenuOpen(false)}
        className={({ isActive }) =>
          `flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
            isActive
              ? item.to === '/keys'
                ? 'bg-amber-400 text-slate-950'
                : 'bg-blue-600 text-white'
              : 'text-gray-400 hover:bg-gray-800 hover:text-white'
          }`
        }
      >
        <Icon size={18} />
        {item.label}
      </NavLink>
    );
  });

  return (
    <div className="flex h-screen">
      <div className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between border-b border-gray-800 bg-gray-900 px-4 py-3 md:hidden">
        <div>
          <h1 className="text-lg font-bold text-white">kscold-control</h1>
          <p className="text-xs text-gray-500">{user?.email}</p>
        </div>
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-gray-400 hover:text-white"
          aria-label="메뉴 열기"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {isMobileMenuOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-label="메뉴 닫기"
        />
      )}

      <aside
        className={`${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        } fixed z-40 flex h-screen w-60 flex-col border-r border-gray-800 bg-gray-900 transition-transform duration-300 ease-in-out md:relative md:translate-x-0`}
      >
        <div className="hidden border-b border-gray-800 p-4 md:block">
          <h1 className="text-lg font-bold text-white">kscold-control</h1>
          <p className="mt-1 truncate text-xs text-gray-500">{user?.email}</p>
        </div>

        <nav className="mt-16 flex-1 space-y-1 overflow-auto p-3 md:mt-0">
          {navLinks}
          {visibleItems.length === 0 && (
            <div className="rounded-lg border border-amber-900/50 bg-amber-950/20 p-3 text-xs leading-5 text-amber-200">
              관리자 승인 후 허용된 메뉴가 표시됩니다.
            </div>
          )}
        </nav>

        <div className="border-t border-gray-800 p-3">
          <button
            type="button"
            onClick={() => {
              logout();
              setIsMobileMenuOpen(false);
            }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-400 hover:bg-gray-800 hover:text-white"
          >
            <LogOut size={18} />
            로그아웃
          </button>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-gray-950 pt-16 md:pt-0">
        {impersonation && (
          <div
            role="status"
            className="flex flex-col gap-3 border-b border-amber-300/30 bg-[linear-gradient(90deg,rgba(120,53,15,0.7),rgba(69,26,3,0.45),rgba(15,23,42,0.95))] px-4 py-3 text-amber-50 sm:flex-row sm:items-center sm:justify-between sm:px-6"
          >
            <div className="flex min-w-0 items-start gap-3 sm:items-center">
              <div className="mt-0.5 rounded-lg border border-amber-300/30 bg-amber-300/10 p-2 text-amber-200 sm:mt-0">
                <Eye size={17} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  QA 미리보기 · {user?.email}
                </p>
                <p className="mt-0.5 text-xs text-amber-100/65">
                  변경·터미널·AI 실행 차단 · {remainingLabel} 후 자동 복귀 ·
                  원래 계정 {impersonation.actorUser.email}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={returnToAdmin}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-amber-200/30 bg-amber-100/10 px-3 py-2 text-xs font-semibold text-amber-50 transition hover:bg-amber-100/20"
            >
              <Undo2 size={15} /> 관리자 화면으로 복귀
            </button>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-hidden">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
