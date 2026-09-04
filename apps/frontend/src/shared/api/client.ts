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
  (error) => {
    if (error.response?.status === 401) {
      const auth = useAuthStore.getState();
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
