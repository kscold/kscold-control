import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/shared/model/auth.store';
import { Layout } from './Layout';
import { Modal } from '@/shared/ui/Modal';
import { SkeletonBlock } from '@/shared/ui/SkeletonBlock';
import { ErrorBoundary } from './providers';
import { DashboardOverviewSkeleton } from '@/features/dashboard';
import { DockerDashboardSkeleton } from '@/features/docker';
import { TopologySkeleton } from '@/features/topology';

const LoginPage = lazy(() =>
  import('@/pages/login').then((m) => ({ default: m.LoginPage })),
);
const DashboardPage = lazy(() =>
  import('@/pages/dashboard').then((m) => ({ default: m.DashboardPage })),
);
const WorkspacePage = lazy(() =>
  import('@/pages/workspace').then((m) => ({ default: m.WorkspacePage })),
);
const DockerPage = lazy(() =>
  import('@/pages/docker').then((m) => ({ default: m.DockerPage })),
);
const RbacPage = lazy(() =>
  import('@/pages/rbac').then((m) => ({ default: m.RbacPage })),
);
const LogsPage = lazy(() =>
  import('@/pages/logs').then((m) => ({ default: m.LogsPage })),
);
const NginxPage = lazy(() =>
  import('@/pages/nginx').then((m) => ({ default: m.NginxPage })),
);
const NetworkPage = lazy(() =>
  import('@/pages/network').then((m) => ({ default: m.NetworkPage })),
);
const TopologyPage = lazy(() =>
  import('@/pages/topology').then((m) => ({ default: m.TopologyPage })),
);
const RepositoryPage = lazy(() =>
  import('@/pages/repository').then((m) => ({ default: m.RepositoryPage })),
);
const AuditPage = lazy(() =>
  import('@/pages/audit').then((m) => ({ default: m.AuditPage })),
);
const SecurityPage = lazy(() =>
  import('@/pages/security').then((m) => ({ default: m.SecurityPage })),
);

function AuthPageLoader() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
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

const TOKEN_REVALIDATE_INTERVAL = 60 * 60 * 1000; // 1시간

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, validateToken } = useAuthStore();

  useEffect(() => {
    if (!token) return;
    validateToken();
    const id = setInterval(validateToken, TOKEN_REVALIDATE_INTERVAL);
    return () => clearInterval(id);
  }, []);

  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
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
          <Route
            index
            element={
              <ErrorBoundary>
                <Suspense fallback={<DashboardOverviewSkeleton />}>
                  <DashboardPage />
                </Suspense>
              </ErrorBoundary>
            }
          />
          <Route
            path="terminal"
            element={
              <ErrorBoundary>
                <Suspense fallback={<RoutePageSkeleton />}>
                  <WorkspacePage />
                </Suspense>
              </ErrorBoundary>
            }
          />
          <Route
            path="docker"
            element={
              <ErrorBoundary>
                <Suspense fallback={<DockerDashboardSkeleton />}>
                  <DockerPage />
                </Suspense>
              </ErrorBoundary>
            }
          />
          <Route
            path="rbac"
            element={
              <ErrorBoundary>
                <Suspense fallback={<RoutePageSkeleton />}>
                  <RbacPage />
                </Suspense>
              </ErrorBoundary>
            }
          />
          <Route
            path="logs"
            element={
              <ErrorBoundary>
                <Suspense fallback={<RoutePageSkeleton />}>
                  <LogsPage />
                </Suspense>
              </ErrorBoundary>
            }
          />
          <Route
            path="nginx"
            element={
              <ErrorBoundary>
                <Suspense fallback={<RoutePageSkeleton />}>
                  <NginxPage />
                </Suspense>
              </ErrorBoundary>
            }
          />
          <Route
            path="network"
            element={
              <ErrorBoundary>
                <Suspense fallback={<RoutePageSkeleton />}>
                  <NetworkPage />
                </Suspense>
              </ErrorBoundary>
            }
          />
          <Route
            path="topology"
            element={
              <ErrorBoundary>
                <Suspense fallback={<TopologySkeleton />}>
                  <TopologyPage />
                </Suspense>
              </ErrorBoundary>
            }
          />
          <Route
            path="repository"
            element={
              <ErrorBoundary>
                <Suspense fallback={<RoutePageSkeleton />}>
                  <RepositoryPage />
                </Suspense>
              </ErrorBoundary>
            }
          />
          <Route
            path="audit"
            element={
              <ErrorBoundary>
                <Suspense fallback={<RoutePageSkeleton />}>
                  <AuditPage />
                </Suspense>
              </ErrorBoundary>
            }
          />
          <Route
            path="security"
            element={
              <ErrorBoundary>
                <Suspense fallback={<RoutePageSkeleton />}>
                  <SecurityPage />
                </Suspense>
              </ErrorBoundary>
            }
          />
        </Route>
      </Routes>
      <Modal />
    </ErrorBoundary>
  );
}
