import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';
import {
  CLAUDE_SESSION_STORAGE_KEY,
  TERMINAL_SESSION_STORAGE_KEY,
} from '../lib/session-storage';
import { API_URL } from '../config';

export interface AuthUser {
  id: string;
  email: string;
  roles: string[];
  permissions: string[];
  impersonation?: {
    sessionId: string;
    actorId: string;
    actorEmail: string;
    expiresAt: string;
    readOnly: true;
  };
}

export interface StartImpersonationData {
  accessToken: string;
  sessionId: string;
  expiresAt: string;
  readOnly: true;
  user: AuthUser;
}

export interface ImpersonationSession {
  actorToken: string;
  actorUser: AuthUser;
  sessionId: string;
  expiresAt: string;
  readOnly: true;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  impersonation: ImpersonationSession | null;
  isValidating: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  validateToken: () => Promise<boolean>;
  beginImpersonation: (data: StartImpersonationData) => boolean;
  endImpersonation: () => boolean;
}

function clearSessionStorageByPrefix(prefix: string) {
  const keysToRemove: string[] = [];

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key && (key === prefix || key.startsWith(`${prefix}:`))) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => localStorage.removeItem(key));
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      impersonation: null,
      isValidating: false,

      login: async (email: string, password: string) => {
        const { data } = await axios.post(`${API_URL}/api/auth/login`, {
          email,
          password,
        });
        set({
          token: data.accessToken,
          user: data.user,
          impersonation: null,
        });
      },

      register: async (email: string, password: string) => {
        await axios.post(`${API_URL}/api/auth/register`, { email, password });
        await get().login(email, password);
      },

      logout: () => {
        // 터미널 세션도 함께 정리
        clearSessionStorageByPrefix(TERMINAL_SESSION_STORAGE_KEY);
        clearSessionStorageByPrefix(CLAUDE_SESSION_STORAGE_KEY);
        set({
          token: null,
          user: null,
          impersonation: null,
          isValidating: false,
        });
      },

      validateToken: async () => {
        let { token } = get();
        const activeImpersonation = get().impersonation;

        if (
          activeImpersonation &&
          Date.parse(activeImpersonation.expiresAt) <= Date.now()
        ) {
          token = activeImpersonation.actorToken;
          set({
            token,
            user: activeImpersonation.actorUser,
            impersonation: null,
          });
        }
        if (!token) return false;

        set({ isValidating: true });
        try {
          const { data } = await axios.get(`${API_URL}/api/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          set({ user: data, isValidating: false });
          return true;
        } catch {
          const impersonation = get().impersonation;
          if (impersonation) {
            try {
              const { data } = await axios.get(`${API_URL}/api/auth/me`, {
                headers: {
                  Authorization: `Bearer ${impersonation.actorToken}`,
                },
              });
              set({
                token: impersonation.actorToken,
                user: data,
                impersonation: null,
                isValidating: false,
              });
              return true;
            } catch {
              // 원래 관리자 세션도 만료됐다면 완전히 로그아웃한다.
            }
          }
          get().logout();
          set({ isValidating: false });
          return false;
        }
      },

      beginImpersonation: (data) => {
        const { token, user, impersonation } = get();
        if (!token || !user || impersonation) return false;

        set({
          token: data.accessToken,
          user: data.user,
          impersonation: {
            actorToken: token,
            actorUser: user,
            sessionId: data.sessionId,
            expiresAt: data.expiresAt,
            readOnly: data.readOnly,
          },
        });
        return true;
      },

      endImpersonation: () => {
        const impersonation = get().impersonation;
        if (!impersonation) return false;

        set({
          token: impersonation.actorToken,
          user: impersonation.actorUser,
          impersonation: null,
          isValidating: false,
        });
        return true;
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        impersonation: state.impersonation,
      }),
    },
  ),
);
