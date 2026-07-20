import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/shared/model';

/**
 * 로그인, 로그아웃, 입력 검증 등 인증 로직을 담당하는 훅
 */
export function useAuth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login: storeLogin } = useAuthStore();
  const navigate = useNavigate();

  /**
   * 로그인 폼 제출을 처리한다
   */
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await storeLogin(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    email,
    password,
    error,
    isLoading,
    setEmail,
    setPassword,
    handleLogin,
  };
}
