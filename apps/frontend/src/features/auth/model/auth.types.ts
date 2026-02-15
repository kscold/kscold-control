/**
 * Login Form State
 */
export interface LoginFormState {
  email: string;
  password: string;
  error: string;
  isLoading: boolean;
}

/**
 * Auth User (from store)
 */
export interface AuthUser {
  id: string;
  email: string;
  roles: string[];
  permissions: string[];
}
