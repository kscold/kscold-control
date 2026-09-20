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
  /** 만료가 임박했으면 토큰을 미리 갱신한다. 갱신했으면 true. */
  ensureFreshToken: () => Promise<boolean>;
  beginImpersonation: (data: StartImpersonationData) => boolean;
  endImpersonation: () => boolean;
}

/** 갱신을 시작할 잔여 수명 — 이보다 적게 남으면 미리 바꾼다 (토큰 수명 7일 기준) */
const REFRESH_THRESHOLD_MS = 24 * 60 * 60 * 1000;

/**
 * JWT 의 만료 시각(ms)을 읽는다. 해석에 실패하면 null 을 돌려준다.
 * 서명 검증은 서버 몫이고, 여기서는 갱신 시점을 정하는 용도로만 쓴다.
 */
function readTokenExpiry(token: string): number | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const exp = (JSON.parse(json) as { exp?: number }).exp;
    return typeof exp === 'number' ? exp * 1000 : null;
  } catch {
    return null;
  }
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

      ensureFreshToken: async () => {
        const { token, impersonation } = get();
        // 사용자 미리보기 세션은 짧은 수명이 의도된 것이라 갱신 대상이 아니다.
        if (!token || impersonation) return false;

        const expiresAt = readTokenExpiry(token);
        if (expiresAt === null) return false;
        if (expiresAt - Date.now() > REFRESH_THRESHOLD_MS) return false;

        try {
          const { data } = await axios.post(
            `${API_URL}/api/auth/refresh`,
            {},
            { headers: { Authorization: `Bearer ${token}` }, timeout: 15_000 },
          );
          // 갱신하는 동안 다른 탭에서 로그인/로그아웃이 일어났다면 덮어쓰지 않는다.
          if (get().token !== token) return false;
          set({ token: data.accessToken, user: data.user });
          return true;
        } catch {
          // 갱신 실패가 곧 로그아웃은 아니다. 남은 수명 동안은 기존 토큰으로 계속 쓴다.
          return false;
        }
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
          if (get().token !== token) return Boolean(get().token);
          set({ user: data, isValidating: false });
          return true;
        } catch (error) {
          if (get().token !== token) return Boolean(get().token);
          if (!axios.isAxiosError(error) || error.response?.status !== 401) {
            set({ isValidating: false });
            return true;
          }
          const impersonation = get().impersonation;
          if (impersonation) {
            try {
              const { data } = await axios.get(`${API_URL}/api/auth/me`, {
                headers: {
                  Authorization: `Bearer ${impersonation.actorToken}`,
                },
              });
              if (get().token !== token) return Boolean(get().token);
              set({
                token: impersonation.actorToken,
                user: data,
                impersonation: null,
                isValidating: false,
              });
              return true;
            } catch (actorError) {
              if (get().token !== token) return Boolean(get().token);
              if (
                !axios.isAxiosError(actorError) ||
                actorError.response?.status !== 401
              ) {
                set({ isValidating: false });
                return true;
              }
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
