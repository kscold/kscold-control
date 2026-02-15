import axios from 'axios';
import { useAuthStore } from '../stores/auth.store';

// API Base URL
export const API_URL = import.meta.env.VITE_API_URL || '';

// Axios instance with automatic authentication
export const api = axios.create({
  baseURL: `${API_URL}/api`,
});

// Request interceptor - Add auth token automatically
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

// Response interceptor - Handle common errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Unauthorized - clear auth and redirect to login
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);
