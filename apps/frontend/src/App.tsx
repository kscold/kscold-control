import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/auth.store';
import { Layout } from './app/Layout';
import { Modal } from './shared/ui/Modal';
import { ErrorBoundary } from './app/providers';

const LoginPage = lazy(() =>
  import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })),
);
const DashboardPage = lazy(() =>
  import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
const ClaudePage = lazy(() =>
  import('./pages/ClaudePage').then((m) => ({ default: m.ClaudePage })),
);
const DockerPage = lazy(() =>
  import('./pages/DockerPage').then((m) => ({ default: m.DockerPage })),
);
const RbacPage = lazy(() =>
  import('./pages/RbacPage').then((m) => ({ default: m.RbacPage })),
);
const LogsPage = lazy(() =>
  import('./pages/LogsPage').then((m) => ({ default: m.LogsPage })),
);
const NginxPage = lazy(() =>
  import('./pages/NginxPage').then((m) => ({ default: m.NginxPage })),
);
const NetworkPage = lazy(() =>
  import('./pages/NetworkPage').then((m) => ({ default: m.NetworkPage })),
);
const TopologyPage = lazy(() =>
  import('./pages/TopologyPage').then((m) => ({ default: m.TopologyPage })),
);

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, validateToken } = useAuthStore();

  useEffect(() => {
    if (token) {
      validateToken();
    }
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
            <Suspense fallback={<PageLoader />}>
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
                <Suspense fallback={<PageLoader />}>
                  <DashboardPage />
                </Suspense>
              </ErrorBoundary>
            }
          />
          <Route
            path="terminal"
            element={
              <ErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                  <ClaudePage />
                </Suspense>
              </ErrorBoundary>
            }
          />
          <Route
            path="docker"
            element={
              <ErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                  <DockerPage />
                </Suspense>
              </ErrorBoundary>
            }
          />
          <Route
            path="rbac"
            element={
              <ErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                  <RbacPage />
                </Suspense>
              </ErrorBoundary>
            }
          />
          <Route
            path="logs"
            element={
              <ErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                  <LogsPage />
                </Suspense>
              </ErrorBoundary>
            }
          />
          <Route
            path="nginx"
            element={
              <ErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                  <NginxPage />
                </Suspense>
              </ErrorBoundary>
            }
          />
          <Route
            path="network"
            element={
              <ErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                  <NetworkPage />
                </Suspense>
              </ErrorBoundary>
            }
          />
          <Route
            path="topology"
            element={
              <ErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                  <TopologyPage />
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
