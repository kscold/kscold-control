import {
  Container,
  FolderGit2,
  KeyRound,
  LayoutDashboard,
  ServerCog,
  ShieldAlert,
  Terminal,
  Users,
} from 'lucide-react';
import type { Permission } from '@/entities/user';
import { PERMISSIONS } from '@/shared/config/permissions';

interface PermissionsListProps {
  permissions: Permission[];
}

const PERMISSION_GROUPS = [
  {
    id: 'dashboard',
    title: '대시보드',
    description: '민감한 원본 목록 없이 운영 상태 요약 조회',
    routes: ['대시보드'],
    icon: LayoutDashboard,
    accent: 'border-sky-500/30 bg-sky-500/5 text-sky-300',
    permissions: [PERMISSIONS.DASHBOARD_READ],
  },
  {
    id: 'terminal',
    title: '터미널 & Claude Code',
    description: '웹 터미널, Claude 실행, 세션 관리',
    routes: ['터미널'],
    icon: Terminal,
    accent: 'border-cyan-500/30 bg-cyan-500/5 text-cyan-300',
    permissions: [
      PERMISSIONS.TERMINAL_ACCESS,
      PERMISSIONS.CLAUDE_EXECUTE,
      PERMISSIONS.SESSION_READ,
      PERMISSIONS.SESSION_WRITE,
    ],
  },
  {
    id: 'docker',
    title: 'Docker & 토폴로지',
    description: '컨테이너 조회, 생성, 제어, 삭제',
    routes: ['Docker 관리', '토폴로지'],
    icon: Container,
    accent: 'border-blue-500/30 bg-blue-500/5 text-blue-300',
    permissions: [
      PERMISSIONS.DOCKER_READ,
      PERMISSIONS.DOCKER_READ_ALL,
      PERMISSIONS.DOCKER_CREATE,
      PERMISSIONS.DOCKER_UPDATE,
      PERMISSIONS.DOCKER_DELETE,
    ],
  },
  {
    id: 'system',
    title: '시스템 운영',
    description: '로그, Nginx, 네트워크와 운영 감사',
    routes: ['시스템 로그', 'Nginx 설정', '네트워크', '운영 감사'],
    icon: ServerCog,
    accent: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-300',
    permissions: [PERMISSIONS.SYSTEM_READ, PERMISSIONS.SYSTEM_WRITE],
  },
  {
    id: 'repository',
    title: '소스 저장소',
    description: '프로젝트 업로드, 다운로드, 삭제',
    routes: ['소스 저장소'],
    icon: FolderGit2,
    accent: 'border-violet-500/30 bg-violet-500/5 text-violet-300',
    permissions: [
      PERMISSIONS.REPOSITORY_READ,
      PERMISSIONS.REPOSITORY_WRITE,
      PERMISSIONS.REPOSITORY_DELETE,
    ],
  },
  {
    id: 'security',
    title: '접근 보안',
    description: 'IP 차단 목록 조회와 정책 변경',
    routes: ['IP 차단'],
    icon: ShieldAlert,
    accent: 'border-rose-500/30 bg-rose-500/5 text-rose-300',
    permissions: [PERMISSIONS.SECURITY_READ, PERMISSIONS.SECURITY_MANAGE],
  },
  {
    id: 'secrets',
    title: '운영 키 관리',
    description: '다중 운영 대상 환경 변수 조회, 복호화, 수정, 배포',
    routes: ['운영 키'],
    icon: KeyRound,
    accent: 'border-amber-400/30 bg-amber-400/5 text-amber-200',
    permissions: [
      PERMISSIONS.SECRETS_READ,
      PERMISSIONS.SECRETS_REVEAL,
      PERMISSIONS.SECRETS_WRITE,
      PERMISSIONS.SECRETS_DEPLOY,
    ],
  },
  {
    id: 'rbac',
    title: '사용자 & 권한',
    description: '사용자 계정과 역할 정책 관리',
    routes: ['권한 관리'],
    icon: Users,
    accent: 'border-fuchsia-500/30 bg-fuchsia-500/5 text-fuchsia-300',
    permissions: [PERMISSIONS.USER_MANAGE, PERMISSIONS.RBAC_MANAGE],
  },
] as const;

/**
 * 사용 가능한 전체 권한을 실제 화면 단위로 묶어 보여준다.
 */
export function PermissionsList({ permissions }: PermissionsListProps) {
  const permissionByName = new Map(
    permissions.map((permission) => [permission.name, permission]),
  );
  const mappedNames = new Set<string>(
    PERMISSION_GROUPS.flatMap((group) => [...group.permissions]),
  );
  const unmatchedPermissions = permissions.filter(
    (permission) => !mappedNames.has(permission.name),
  );

  return (
    <section className="mt-6 rounded-2xl border border-slate-700/80 bg-slate-900/70 p-4 sm:p-5">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">기능별 권한 맵</h2>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            사이드바의 실제 운영 화면과 API 권한을 같은 패널로 묶었습니다.
          </p>
        </div>
        <span className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 text-xs text-slate-400">
          전체 {permissions.length}개
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {PERMISSION_GROUPS.map((group) => {
          const groupPermissions = group.permissions
            .map((name) => permissionByName.get(name))
            .filter((permission): permission is Permission =>
              Boolean(permission),
            );
          const Icon = group.icon;

          return (
            <article
              key={group.id}
              className="overflow-hidden rounded-xl border border-slate-700/80 bg-slate-950/45"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 px-4 py-3.5">
                <div className="flex min-w-0 items-start gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${group.accent}`}
                  >
                    <Icon size={19} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-slate-100">
                      {group.title}
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {group.description}
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-slate-800 px-2.5 py-1 text-[11px] text-slate-400">
                  {groupPermissions.length}개 권한
                </span>
              </div>

              <div className="border-b border-slate-800/80 px-4 py-2.5">
                <div className="flex flex-wrap gap-1.5">
                  {group.routes.map((route) => (
                    <span
                      key={route}
                      className="rounded-md border border-slate-700/80 bg-slate-900 px-2 py-1 text-[11px] text-slate-400"
                    >
                      {route}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2">
                {groupPermissions.map((permission) => (
                  <div
                    key={permission.id}
                    className="rounded-lg border border-slate-800 bg-slate-900/70 p-3"
                  >
                    <p className="font-mono text-xs font-semibold text-slate-200">
                      {permission.name}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {permission.description}
                    </p>
                  </div>
                ))}
                {groupPermissions.length === 0 && (
                  <p className="col-span-full px-1 py-3 text-xs text-slate-600">
                    등록된 권한이 없습니다.
                  </p>
                )}
              </div>
            </article>
          );
        })}

        {unmatchedPermissions.length > 0 && (
          <article className="rounded-xl border border-dashed border-slate-700 bg-slate-950/30 p-4">
            <h3 className="font-semibold text-slate-200">기타 권한</h3>
            <p className="mt-1 text-xs text-slate-500">
              새로 추가되어 아직 화면에 매핑되지 않은 권한입니다.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {unmatchedPermissions.map((permission) => (
                <div
                  key={permission.id}
                  className="rounded-lg border border-slate-800 bg-slate-900/70 p-3"
                >
                  <p className="font-mono text-xs font-semibold text-slate-200">
                    {permission.name}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {permission.description}
                  </p>
                </div>
              ))}
            </div>
          </article>
        )}
      </div>
    </section>
  );
}
