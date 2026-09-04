import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/shared/model';

/**
 * 로그인, 로그아웃, 입력 검증 등 인증 로직을 담당하는 훅
 */
export function useAuth() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login: storeLogin, register: storeRegister } = useAuthStore();
  const navigate = useNavigate();

  /**
   * 로그인 폼 제출을 처리한다
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (mode === 'register') {
        if (password !== confirmPassword) {
          setError('비밀번호 확인이 일치하지 않습니다.');
          return;
        }
        await storeRegister(email, password);
      } else {
        await storeLogin(email, password);
      }
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const changeMode = (nextMode: 'login' | 'register') => {
    setMode(nextMode);
    setError('');
    setPassword('');
    setConfirmPassword('');
  };

  return {
    mode,
    email,
    password,
    confirmPassword,
    error,
    isLoading,
    setEmail,
    setPassword,
    setConfirmPassword,
    changeMode,
    handleSubmit,
  };
}
