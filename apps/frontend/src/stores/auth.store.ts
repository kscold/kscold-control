import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '';

interface User {
  id: string;
  email: string;
  roles: string[];
}

interface AuthState {
  token: string | null;
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,

      login: async (email: string, password: string) => {
        const { data } = await axios.post(`${API_URL}/api/auth/login`, {
          email,
          password,
        });
        set({ token: data.accessToken, user: data.user });
      },

      logout: () => {
        set({ token: null, user: null });
      },

      hasPermission: (permission: string) => {
        const { user } = get();
        if (!user) return false;
        if (user.roles.includes('admin')) return true;
        return false; // 세밀한 권한은 백엔드에서 처리
      },
    }),
    { name: 'auth-storage' },
  ),
);
