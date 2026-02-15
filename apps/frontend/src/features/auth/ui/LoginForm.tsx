import { useAuth } from '../hooks/useAuth';

/**
 * LoginForm Component
 * Login form UI with validation and error handling
 *
 * Extracted from LoginPage.tsx lines 28-86
 */
export function LoginForm() {
  const { email, password, error, isLoading, setEmail, setPassword, handleLogin } =
    useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 p-4">
      <div className="w-full max-w-sm">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 sm:p-8">
          <h1 className="text-xl sm:text-2xl font-bold text-white text-center mb-2">
            kscold-control
          </h1>
          <p className="text-gray-500 text-center text-xs sm:text-sm mb-6 sm:mb-8">
            맥 미니 인프라 관리 시스템
          </p>

          {error && (
            <div className="bg-red-900/30 border border-red-800 text-red-400 text-xs sm:text-sm px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-3 sm:space-y-4">
            <div>
              <label className="block text-xs sm:text-sm text-gray-400 mb-1">
                이메일
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                placeholder="email"
                required
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm text-gray-400 mb-1">
                비밀번호
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                placeholder="비밀번호"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 sm:py-3 text-sm sm:text-base bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isLoading ? '로그인 중...' : '로그인'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
