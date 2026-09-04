import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { DashboardOverviewSkeleton } from '@/features/dashboard';
import { DockerDashboardSkeleton } from '@/features/docker';
import { TopologySkeleton } from '@/features/topology';
import { PERMISSIONS } from '@/shared/config/permissions';
import { ROLES } from '@/shared/config/roles';
import { useAuthStore } from '@/shared/model/auth.store';
import { Modal } from '@/shared/ui/Modal';
import { SkeletonBlock } from '@/shared/ui/SkeletonBlock';
import { Layout } from './Layout';
import { ErrorBoundary } from './providers';

const LoginPage = lazy(() =>
  import('@/pages/login').then((module) => ({ default: module.LoginPage })),
);
const DashboardPage = lazy(() =>
  import('@/pages/dashboard').then((module) => ({
    default: module.DashboardPage,
  })),
);
const WorkspacePage = lazy(() =>
  import('@/pages/workspace').then((module) => ({
    default: module.WorkspacePage,
  })),
);
const DockerPage = lazy(() =>
  import('@/pages/docker').then((module) => ({ default: module.DockerPage })),
);
const RbacPage = lazy(() =>
  import('@/pages/rbac').then((module) => ({ default: module.RbacPage })),
);
const LogsPage = lazy(() =>
  import('@/pages/logs').then((module) => ({ default: module.LogsPage })),
);
const NginxPage = lazy(() =>
  import('@/pages/nginx').then((module) => ({ default: module.NginxPage })),
);
const NetworkPage = lazy(() =>
  import('@/pages/network').then((module) => ({ default: module.NetworkPage })),
);
const TopologyPage = lazy(() =>
  import('@/pages/topology').then((module) => ({
    default: module.TopologyPage,
  })),
);
const RepositoryPage = lazy(() =>
  import('@/pages/repository').then((module) => ({
    default: module.RepositoryPage,
  })),
);
const AuditPage = lazy(() =>
  import('@/pages/audit').then((module) => ({ default: module.AuditPage })),
);
const SecurityPage = lazy(() =>
  import('@/pages/security').then((module) => ({
    default: module.SecurityPage,
  })),
);
const KeyManagementPage = lazy(() =>
  import('@/pages/key-management').then((module) => ({
    default: module.KeyManagementPage,
  })),
);
const PendingApprovalPage = lazy(() =>
  import('@/pages/pending-approval').then((module) => ({
    default: module.PendingApprovalPage,
  })),
);

function AuthPageLoader() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-500" />
    </div>
  );
}

function RoutePageSkeleton() {
  return (
    <div className="h-full overflow-auto bg-gray-950 p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between sm:mb-6">
        <SkeletonBlock className="h-9 w-48 rounded-lg" />
        <SkeletonBlock className="h-10 w-10 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="rounded-2xl border border-gray-800 bg-gray-900/70 p-5"
          >
            <SkeletonBlock className="h-6 w-40 rounded-lg" />
            <SkeletonBlock className="mt-3 h-4 w-56 rounded-md" />
            <div className="mt-4 space-y-3">
              <SkeletonBlock className="h-12 w-full rounded-xl" />
              <SkeletonBlock className="h-12 w-full rounded-xl" />
              <SkeletonBlock className="h-24 w-full rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const TOKEN_REVALIDATE_INTERVAL = 60 * 60 * 1000;

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, validateToken } = useAuthStore();

  useEffect(() => {
    if (!token) return;
    void validateToken();
    const id = window.setInterval(
      () => void validateToken(),
      TOKEN_REVALIDATE_INTERVAL,
    );
    return () => window.clearInterval(id);
  }, [token, validateToken]);

  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PermissionRoute({
  permission,
  children,
}: {
  permission: string;
  children: React.ReactNode;
}) {
  const user = useAuthStore((state) => state.user);
  if (user?.permissions.includes(permission)) return <>{children}</>;
  if (user?.roles.includes(ROLES.PENDING_APPROVAL)) {
    return <Navigate to="/pending" replace />;
  }
  return <Navigate to="/" replace />;
}

function HomeRoute() {
  const user = useAuthStore((state) => state.user);
  if (!user) return <AuthPageLoader />;
  if (user.roles.includes(ROLES.PENDING_APPROVAL)) {
    return <Navigate to="/pending" replace />;
  }
  if (user.permissions.includes(PERMISSIONS.DASHBOARD_READ)) {
    return (
      <ErrorBoundary>
        <Suspense fallback={<DashboardOverviewSkeleton />}>
          <DashboardPage />
        </Suspense>
      </ErrorBoundary>
    );
  }

  const firstAllowedRoute = [
    [PERMISSIONS.SECRETS_READ, '/keys'],
    [PERMISSIONS.TERMINAL_ACCESS, '/terminal'],
    [PERMISSIONS.DOCKER_READ, '/docker'],
    [PERMISSIONS.RBAC_MANAGE, '/rbac'],
    [PERMISSIONS.REPOSITORY_READ, '/repository'],
    [PERMISSIONS.SECURITY_READ, '/security'],
  ].find(([permission]) => user.permissions.includes(permission));

  return firstAllowedRoute ? (
    <Navigate to={firstAllowedRoute[1]} replace />
  ) : (
    <Navigate to="/pending" replace />
  );
}

function page(
  permission: string,
  content: React.ReactNode,
  fallback: React.ReactNode = <RoutePageSkeleton />,
) {
  return (
    <PermissionRoute permission={permission}>
      <ErrorBoundary>
        <Suspense fallback={fallback}>{content}</Suspense>
      </ErrorBoundary>
    </PermissionRoute>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route
          path="/login"
          element={
            <Suspense fallback={<AuthPageLoader />}>
              <LoginPage />
            </Suspense>
          }
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<HomeRoute />} />
          <Route
            path="pending"
            element={
              <Suspense fallback={<RoutePageSkeleton />}>
                <PendingApprovalPage />
              </Suspense>
            }
          />
          <Route
            path="keys"
            element={page(PERMISSIONS.SECRETS_READ, <KeyManagementPage />)}
          />
          <Route
            path="terminal"
            element={page(PERMISSIONS.TERMINAL_ACCESS, <WorkspacePage />)}
          />
          <Route
            path="docker"
            element={page(
              PERMISSIONS.DOCKER_READ,
              <DockerPage />,
              <DockerDashboardSkeleton />,
            )}
          />
          <Route
            path="rbac"
            element={page(PERMISSIONS.RBAC_MANAGE, <RbacPage />)}
          />
          <Route
            path="logs"
            element={page(PERMISSIONS.SYSTEM_READ, <LogsPage />)}
          />
          <Route
            path="nginx"
            element={page(PERMISSIONS.SYSTEM_READ, <NginxPage />)}
          />
          <Route
            path="network"
            element={page(PERMISSIONS.SYSTEM_READ, <NetworkPage />)}
          />
          <Route
            path="topology"
            element={page(
              PERMISSIONS.DOCKER_READ,
              <TopologyPage />,
              <TopologySkeleton />,
            )}
          />
          <Route
            path="repository"
            element={page(PERMISSIONS.REPOSITORY_READ, <RepositoryPage />)}
          />
          <Route
            path="audit"
            element={page(PERMISSIONS.SYSTEM_READ, <AuditPage />)}
          />
          <Route
            path="security"
            element={page(PERMISSIONS.SECURITY_READ, <SecurityPage />)}
          />
        </Route>
      </Routes>
      <Modal />
    </ErrorBoundary>
  );
}
