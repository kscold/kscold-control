import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '';

interface User {
  id: string;
  email: string;
  roles: string[];
  permissions: string[];
}

interface AuthState {
  token: string | null;
  user: User | null;
  isValidating: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  validateToken: () => Promise<boolean>;
  hasPermission: (permission: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isValidating: false,

      login: async (email: string, password: string) => {
        const { data } = await axios.post(`${API_URL}/api/auth/login`, {
          email,
          password,
        });
        set({ token: data.accessToken, user: data.user });
      },

      logout: () => {
        // 터미널 세션도 함께 정리
        localStorage.removeItem('terminal_session_id');
        set({ token: null, user: null });
      },

      validateToken: async () => {
        const { token } = get();
        if (!token) return false;

        set({ isValidating: true });
        try {
          const { data } = await axios.get(`${API_URL}/api/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          set({ user: data, isValidating: false });
          return true;
        } catch {
          // 토큰이 만료되었거나 유효하지 않음 -> 자동 로그아웃
          get().logout();
          set({ isValidating: false });
          return false;
        }
      },

      hasPermission: (permission: string) => {
        const { user } = get();
        if (!user) return false;
        if (user.roles.includes('admin')) return true;
        return false; // 세밀한 권한은 백엔드에서 처리
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
      }),
    },
  ),
);
