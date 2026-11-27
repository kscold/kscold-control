import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Container,
  DatabaseBackup,
  FileText,
  FolderGit2,
  GitBranch,
  Globe,
  Activity,
  HardDrive,
  History,
  Eye,
  KeyRound,
  LayoutDashboard,
  LogOut,
  MoreHorizontal,
  Network,
  Shield,
  ShieldAlert,
  Terminal,
  Monitor,
  Undo2,
  UserRound,
} from 'lucide-react';
import { PERMISSIONS } from '@/shared/config/permissions';
import { useAuthStore } from '@/shared/model';
import { ROLES } from '@/shared/config/roles';

const NAV_ITEMS = [
  {
    to: '/',
    end: true,
    label: '대시보드',
    icon: LayoutDashboard,
    permission: PERMISSIONS.DASHBOARD_READ,
  },
  {
    to: '/uptime',
    label: '서비스 감시',
    icon: Activity,
    permission: PERMISSIONS.SYSTEM_READ,
  },
  {
    to: '/remote-desktop',
    label: '원격 데스크톱',
    icon: Monitor,
    administratorOnly: true,
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
    to: '/backups',
    label: '백업 관리',
    icon: DatabaseBackup,
    permission: PERMISSIONS.BACKUP_READ,
  },
  {
    to: '/maintenance',
    label: '저장공간',
    icon: HardDrive,
    permission: PERMISSIONS.SYSTEM_READ,
  },
  {
    to: '/audit',
    label: '운영 기록',
    icon: History,
    permission: PERMISSIONS.SYSTEM_READ,
  },
  {
    to: '/security',
    label: '접속 보안',
    icon: ShieldAlert,
    permission: PERMISSIONS.SECURITY_READ,
  },
] as const;

/** 휴대폰 아래 탭에 바로 두는 화면. 나머지는 '더보기' 시트로 연다. */
const MOBILE_TABS = ['/', '/terminal', '/docker', '/security'] as const;

const MOBILE_TAB_LABEL: Record<string, string> = {
  '/': '홈',
  '/terminal': '터미널',
  '/docker': 'Docker',
  '/security': '보안',
};

export function Layout() {
  const { user, logout, impersonation, endImpersonation } = useAuthStore();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const permissions = new Set(user?.permissions ?? []);
  const visibleItems = NAV_ITEMS.filter((item) =>
    'administratorOnly' in item
      ? !impersonation &&
        user?.roles.some(
          (role) => role === ROLES.ADMIN || role === ROLES.SUPER_ADMIN,
        )
      : permissions.has(item.permission),
  );

  const mobileTabs = visibleItems.filter((item) =>
    (MOBILE_TABS as readonly string[]).includes(item.to),
  );
  const moreItems = visibleItems.filter(
    (item) => !(MOBILE_TABS as readonly string[]).includes(item.to),
  );
  const current = visibleItems.find((item) =>
    item.to === '/' ? pathname === '/' : pathname.startsWith(item.to),
  );
  const currentLabel =
    current?.label ??
    (pathname.startsWith('/account') ? '내 계정' : 'kscold-control');
  const inMoreMenu = moreItems.some((item) => pathname.startsWith(item.to));
  // 터미널은 자체 탭 줄이 위 막대 역할을 한다. 막대를 하나 더 두면 화면이 좁아진다.
  const ownHeader = pathname.startsWith('/terminal');
  const keyboardOpen = useKeyboardOpen();
  const showTabBar = !keyboardOpen;

  // 다른 화면으로 가면 더보기 시트를 닫는다
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

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
    <div className="flex h-dvh">
      {/* 휴대폰: 위에는 지금 화면 이름만, 이동은 엄지가 닿는 아래 탭으로 한다 */}
      <header
        className={`fixed inset-x-0 top-0 z-30 h-12 ${ownHeader ? 'hidden' : 'flex'} items-center border-b border-gray-800 bg-gray-900/95 px-4 pt-[env(safe-area-inset-top)] backdrop-blur md:hidden`}
      >
        <h1 className="truncate text-base font-semibold text-white">
          {currentLabel}
        </h1>
      </header>

      <aside className="relative hidden h-dvh w-60 flex-col border-r border-gray-800 bg-gray-900 md:flex">
        <div className="hidden border-b border-gray-800 p-4 md:block">
          <h1 className="text-lg font-bold text-white">kscold-control</h1>
          <p className="mt-1 truncate text-xs text-gray-500">{user?.email}</p>
        </div>

        <nav className="flex-1 space-y-1 overflow-auto p-3">
          {navLinks}
          {visibleItems.length === 0 && (
            <div className="rounded-lg border border-amber-900/50 bg-amber-950/20 p-3 text-xs leading-5 text-amber-200">
              관리자 승인 후 허용된 메뉴가 표시됩니다.
            </div>
          )}
        </nav>

        <div className="space-y-1 border-t border-gray-800 p-3">
          {!impersonation && (
            <NavLink
              to="/account"
              onClick={() => setIsMobileMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`
              }
            >
              <UserRound size={18} />내 계정
            </NavLink>
          )}
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

      <main
        className={`flex min-w-0 flex-1 flex-col overflow-hidden bg-gray-950 md:pb-0 md:pt-0 ${
          showTabBar ? 'pb-[calc(3.5rem+env(safe-area-inset-bottom))]' : ''
        } ${ownHeader ? 'pt-[env(safe-area-inset-top)]' : 'pt-12'}`}
      >
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

      <nav
        aria-label="주요 화면"
        hidden={!showTabBar}
        className="fixed inset-x-0 bottom-0 z-30 grid border-t border-gray-800 bg-gray-900/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
        style={{
          gridTemplateColumns: `repeat(${mobileTabs.length + 1}, minmax(0, 1fr))`,
        }}
      >
        {mobileTabs.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={'end' in item ? item.end : undefined}
              onClick={() => setIsMobileMenuOpen(false)}
              className={({ isActive }) =>
                `flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] ${
                  isActive ? 'text-blue-400' : 'text-gray-400 active:text-white'
                }`
              }
            >
              <Icon size={22} />
              {MOBILE_TAB_LABEL[item.to] ?? item.label}
            </NavLink>
          );
        })}
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen((open) => !open)}
          aria-expanded={isMobileMenuOpen}
          className={`flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] ${
            isMobileMenuOpen || inMoreMenu ? 'text-blue-400' : 'text-gray-400'
          }`}
        >
          <MoreHorizontal size={22} />
          더보기
        </button>
      </nav>

      {isMobileMenuOpen && (
        <div className="md:hidden">
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-label="더보기 닫기"
          />
          <div
            role="dialog"
            aria-label="더보기"
            className="animate-sheet-in fixed inset-x-0 bottom-0 z-50 max-h-[80dvh] overflow-auto rounded-t-2xl border-t border-gray-800 bg-gray-900 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3"
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-700" />
            <p className="mb-3 truncate text-xs text-gray-500">{user?.email}</p>
            <div className="grid grid-cols-3 gap-2">
              {moreItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex flex-col items-center gap-1.5 rounded-xl px-1 py-3 text-center text-xs ${
                        isActive
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-800/70 text-gray-300 active:bg-gray-700'
                      }`
                    }
                  >
                    <Icon size={22} />
                    <span className="leading-tight">{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {!impersonation && (
                <NavLink
                  to="/account"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-2 rounded-xl bg-gray-800/70 py-3 text-sm text-gray-300"
                >
                  <UserRound size={18} />내 계정
                </NavLink>
              )}
              <button
                type="button"
                onClick={() => {
                  logout();
                  setIsMobileMenuOpen(false);
                }}
                className="flex items-center justify-center gap-2 rounded-xl bg-gray-800/70 py-3 text-sm text-gray-300"
              >
                <LogOut size={18} />
                로그아웃
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 휴대폰 키보드가 올라오면 화면 높이가 크게 줄어든다. 그때는 아래 탭을 숨겨 입력할 자리를 넓힌다.
 * (visualViewport 가 창 높이의 3/4 아래로 줄면 키보드가 열린 것으로 본다)
 */
function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => setOpen(viewport.height < window.innerHeight * 0.75);
    viewport.addEventListener('resize', update);
    update();
    return () => viewport.removeEventListener('resize', update);
  }, []);
  return open;
}
