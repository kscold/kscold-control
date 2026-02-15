import axios from 'axios';
import { api } from '../../lib/api';
import { BaseApiService } from './base.service';
import {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  MeResponse,
} from '../../types';

const API_URL = import.meta.env.VITE_API_URL || '';

/**
 * Auth API Service
 * Centralizes all authentication-related API calls
 *
 * Replaces direct API calls in:
 * - auth.store.ts
 * - LoginPage.tsx
 */
export class AuthService extends BaseApiService {
  private readonly basePath = '/auth';

  /**
   * Login with email and password
   * @param request Login credentials
   * @returns Access token and user data
   */
  async login(request: LoginRequest): Promise<LoginResponse> {
    try {
      // Use raw axios for login (before token is set)
      const { data } = await axios.post<LoginResponse>(
        `${API_URL}/api${this.basePath}/login`,
        request,
      );
      return data;
    } catch (error) {
      this.logError('AuthService', 'login', error);
      this.handleError(error, 'Login failed. Please check your credentials.');
    }
  }

  /**
   * Register a new user
   * @param request Registration data
   * @returns User data
   */
  async register(
    request: RegisterRequest,
  ): Promise<{ email: string; id: string }> {
    try {
      const { data } = await axios.post<{ email: string; id: string }>(
        `${API_URL}/api${this.basePath}/register`,
        request,
      );
      return data;
    } catch (error) {
      this.logError('AuthService', 'register', error);
      this.handleError(error, 'Registration failed');
    }
  }

  /**
   * Get current user information
   * @returns Current user data with permissions
   */
  async getMe(): Promise<MeResponse> {
    try {
      const { data } = await api.get<MeResponse>(`${this.basePath}/me`);
      return data;
    } catch (error) {
      this.logError('AuthService', 'getMe', error);
      this.handleError(error, 'Failed to get user information');
    }
  }

  /**
   * Logout (client-side only)
   * Clears local storage and auth state
   */
  logout(): void {
    localStorage.removeItem('auth-storage');
    localStorage.removeItem('terminal_session_id');
  }
}

// Export singleton instance
export const authService = new AuthService();
