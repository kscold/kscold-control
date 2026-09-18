import axios from 'axios';
import { useAuthStore } from '../model/auth.store';
import { API_URL } from '../config';

// 인증 토큰을 자동으로 붙이는 axios 인스턴스
export const api = axios.create({
  baseURL: `${API_URL}/api`,
});

// 요청 인터셉터 - 인증 토큰을 자동으로 추가한다
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// 응답 인터셉터 - 공통 에러를 처리한다
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const auth = useAuthStore.getState();
      const sentToken = error.config?.headers?.Authorization;
      // An old request must not clear a newer login or restored admin session.
      if (!auth.token || sentToken !== `Bearer ${auth.token}`) {
        return Promise.reject(error);
      }
      if (!error.config._authRechecked) {
        try {
          await axios.get(`${API_URL}/api/auth/me`, {
            headers: { Authorization: sentToken, 'Cache-Control': 'no-cache' },
            timeout: 10_000,
          });
          if (useAuthStore.getState().token === auth.token) {
            error.config._authRechecked = true;
            return api.request(error.config);
          }
          return Promise.reject(error);
        } catch (validationError) {
          if (
            !axios.isAxiosError(validationError) ||
            validationError.response?.status !== 401
          ) {
            return Promise.reject(error);
          }
        }
      } else {
        // A valid session with a failing endpoint is not a reason to log out.
        return Promise.reject(error);
      }
      if (useAuthStore.getState().token !== auth.token)
        return Promise.reject(error);
      if (auth.impersonation && auth.endImpersonation()) {
        window.location.href = '/rbac';
      } else {
        auth.logout();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);
