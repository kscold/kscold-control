/**
 * 로그인 폼 상태
 */
export interface LoginFormState {
  email: string;
  password: string;
  error: string;
  isLoading: boolean;
}

/**
 * 스토어에 저장된 인증 사용자 정보
 */
export interface AuthUser {
  id: string;
  email: string;
  roles: string[];
  permissions: string[];
}
