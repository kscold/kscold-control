import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/auth.store';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ClaudePage } from './pages/ClaudePage';
import { DockerPage } from './pages/DockerPage';
import { RbacPage } from './pages/RbacPage';
import { LogsPage } from './pages/LogsPage';
import { NginxPage } from './pages/NginxPage';
import { NetworkPage } from './pages/NetworkPage';
import { TopologyPage } from './pages/TopologyPage';
import { Modal } from './components/Modal';
import { ErrorBoundary } from './app/providers';

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
        <Route path="/login" element={<LoginPage />} />
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
                <DashboardPage />
              </ErrorBoundary>
            }
          />
          <Route
            path="terminal"
            element={
              <ErrorBoundary>
                <ClaudePage />
              </ErrorBoundary>
            }
          />
          <Route
            path="docker"
            element={
              <ErrorBoundary>
                <DockerPage />
              </ErrorBoundary>
            }
          />
          <Route
            path="rbac"
            element={
              <ErrorBoundary>
                <RbacPage />
              </ErrorBoundary>
            }
          />
          <Route
            path="logs"
            element={
              <ErrorBoundary>
                <LogsPage />
              </ErrorBoundary>
            }
          />
          <Route
            path="nginx"
            element={
              <ErrorBoundary>
                <NginxPage />
              </ErrorBoundary>
            }
          />
          <Route
            path="network"
            element={
              <ErrorBoundary>
                <NetworkPage />
              </ErrorBoundary>
            }
          />
          <Route
            path="topology"
            element={
              <ErrorBoundary>
                <TopologyPage />
              </ErrorBoundary>
            }
          />
        </Route>
      </Routes>
      <Modal />
    </ErrorBoundary>
  );
}
