import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  Terminal,
  Container,
  LayoutDashboard,
  LogOut,
  Menu,
  X,
  Shield,
  FileText,
  Globe,
  Network,
  GitBranch,
} from 'lucide-react';
import { useAuthStore } from '../stores/auth.store';

export function Layout() {
  const { user, logout } = useAuthStore();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navLinks = (
    <>
      <NavLink
        to="/"
        end
        onClick={() => setIsMobileMenuOpen(false)}
        className={({ isActive }) =>
          `flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${
            isActive
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:bg-gray-800 hover:text-white'
          }`
        }
      >
        <LayoutDashboard size={18} />
        대시보드
      </NavLink>

      <NavLink
        to="/terminal"
        onClick={() => setIsMobileMenuOpen(false)}
        className={({ isActive }) =>
          `flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${
            isActive
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:bg-gray-800 hover:text-white'
          }`
        }
      >
        <Terminal size={18} />
        터미널
      </NavLink>

      <NavLink
        to="/docker"
        onClick={() => setIsMobileMenuOpen(false)}
        className={({ isActive }) =>
          `flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${
            isActive
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:bg-gray-800 hover:text-white'
          }`
        }
      >
        <Container size={18} />
        Docker 관리
      </NavLink>

      <NavLink
        to="/rbac"
        onClick={() => setIsMobileMenuOpen(false)}
        className={({ isActive }) =>
          `flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${
            isActive
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:bg-gray-800 hover:text-white'
          }`
        }
      >
        <Shield size={18} />
        권한 관리
      </NavLink>

      <NavLink
        to="/logs"
        onClick={() => setIsMobileMenuOpen(false)}
        className={({ isActive }) =>
          `flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${
            isActive
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:bg-gray-800 hover:text-white'
          }`
        }
      >
        <FileText size={18} />
        시스템 로그
      </NavLink>

      <NavLink
        to="/nginx"
        onClick={() => setIsMobileMenuOpen(false)}
        className={({ isActive }) =>
          `flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${
            isActive
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:bg-gray-800 hover:text-white'
          }`
        }
      >
        <Globe size={18} />
        Nginx 설정
      </NavLink>

      <NavLink
        to="/network"
        onClick={() => setIsMobileMenuOpen(false)}
        className={({ isActive }) =>
          `flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${
            isActive
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:bg-gray-800 hover:text-white'
          }`
        }
      >
        <Network size={18} />
        네트워크
      </NavLink>

      <NavLink
        to="/topology"
        onClick={() => setIsMobileMenuOpen(false)}
        className={({ isActive }) =>
          `flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${
            isActive
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:bg-gray-800 hover:text-white'
          }`
        }
      >
        <GitBranch size={18} />
        토폴로지
      </NavLink>
    </>
  );

  return (
    <div className="flex h-screen">
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">kscold-control</h1>
          <p className="text-xs text-gray-500">{user?.email}</p>
        </div>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="text-gray-400 hover:text-white p-2"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
          fixed md:relative
          z-40
          w-60 bg-gray-900 border-r border-gray-800 flex flex-col
          transition-transform duration-300 ease-in-out
          h-screen
        `}
      >
        <div className="hidden md:block p-4 border-b border-gray-800">
          <h1 className="text-lg font-bold text-white">kscold-control</h1>
          <p className="text-xs text-gray-500 mt-1">{user?.email}</p>
        </div>

        <nav className="flex-1 p-3 space-y-1 mt-16 md:mt-0">{navLinks}</nav>

        <div className="p-3 border-t border-gray-800">
          <button
            onClick={() => {
              logout();
              setIsMobileMenuOpen(false);
            }}
            className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-white"
          >
            <LogOut size={18} />
            로그아웃
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden bg-gray-950 pt-16 md:pt-0">
        <Outlet />
      </main>
    </div>
  );
}
