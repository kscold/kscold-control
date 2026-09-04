import { useAuth } from '../model/useAuth';

/**
 * 입력 검증과 에러 처리를 포함한 로그인 폼 UI
 */
export function LoginForm() {
  const {
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
  } = useAuth();

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#071018] p-4">
      <div className="absolute -left-24 top-1/4 h-80 w-80 rounded-full bg-sky-500/10 blur-3xl" />
      <div className="absolute -right-24 bottom-1/4 h-80 w-80 rounded-full bg-amber-400/10 blur-3xl" />
      <div className="relative w-full max-w-md">
        <div className="rounded-[28px] border border-slate-800 bg-slate-950/80 p-6 shadow-2xl shadow-black/40 backdrop-blur sm:p-8">
          <div className="mx-auto mb-5 h-14 w-14 overflow-hidden rounded-2xl border border-sky-400/20 bg-slate-950 shadow-lg shadow-sky-950/50">
            <img
              src="/favicon.svg"
              alt="kscold-control"
              className="h-full w-full"
            />
          </div>
          <h1 className="text-center text-2xl font-bold text-white">
            {mode === 'login' ? 'kscold-control' : '개발자 접근 요청'}
          </h1>
          <p className="mb-6 mt-2 text-center text-sm leading-6 text-slate-500">
            {mode === 'login'
              ? '운영 인프라와 배포 키를 안전하게 관리합니다.'
              : '가입 후 관리자의 승인이 완료되면 허용된 화면만 열립니다.'}
          </p>

          <div className="mb-5 grid grid-cols-2 rounded-xl bg-slate-900 p-1">
            <button
              type="button"
              onClick={() => changeMode('login')}
              className={`rounded-lg py-2 text-sm ${
                mode === 'login'
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              로그인
            </button>
            <button
              type="button"
              onClick={() => changeMode('register')}
              className={`rounded-lg py-2 text-sm ${
                mode === 'register'
                  ? 'bg-amber-400 font-semibold text-slate-950'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              회원가입 요청
            </button>
          </div>

          {error && (
            <div className="bg-red-900/30 border border-red-800 text-red-400 text-xs sm:text-sm px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs sm:text-sm text-gray-400 mb-1">
                이메일
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-amber-400"
                placeholder="developer@example.com"
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
                minLength={mode === 'register' ? 8 : undefined}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-amber-400"
                placeholder="8자 이상 비밀번호"
                required
              />
            </div>

            {mode === 'register' && (
              <div>
                <label className="mb-1 block text-sm text-slate-400">
                  비밀번호 확인
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  minLength={8}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-amber-400"
                  placeholder="비밀번호를 다시 입력하세요"
                  required
                />
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-xl bg-amber-400 py-3 text-sm font-bold text-slate-950 transition-colors hover:bg-amber-300 disabled:opacity-50"
            >
              {isLoading
                ? '처리 중...'
                : mode === 'login'
                  ? '로그인'
                  : '가입하고 승인 대기'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
