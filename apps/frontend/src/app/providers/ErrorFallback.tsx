import { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

function isChunkLoadError(error: Error): boolean {
  return (
    error.message.includes('Failed to fetch dynamically imported module') ||
    error.message.includes('Importing a module script failed') ||
    error.message.includes('error loading dynamically imported module') ||
    (error.name === 'TypeError' && error.message.includes('Failed to fetch'))
  );
}

export function ErrorFallback({
  error,
  resetErrorBoundary,
}: ErrorFallbackProps) {
  const chunkError = isChunkLoadError(error);
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    if (!chunkError) return;
    if (countdown <= 0) {
      window.location.reload();
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [chunkError, countdown]);

  if (chunkError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 p-4">
        <div className="w-full max-w-md">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 sm:p-8 text-center">
            <RefreshCw
              className="text-blue-400 mx-auto mb-4 animate-spin"
              size={36}
            />
            <h1 className="text-xl font-bold text-white mb-2">
              새 버전이 배포되었습니다
            </h1>
            <p className="text-gray-400 text-sm mb-4">
              {countdown > 0
                ? `${countdown}초 후 자동으로 새로고침됩니다.`
                : '새로고침 중...'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              지금 새로고침
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 p-4">
      <div className="w-full max-w-md">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="text-red-500" size={32} />
            <h1 className="text-xl sm:text-2xl font-bold text-white">
              오류가 발생했습니다
            </h1>
          </div>

          <p className="text-gray-400 text-sm mb-4">
            애플리케이션 실행 중 오류가 발생했습니다. 아래 버튼을 클릭하여 다시
            시도하거나, 문제가 지속되면 관리자에게 문의하세요.
          </p>

          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-4">
            <p className="text-red-400 text-xs font-mono break-all">
              {error.message}
            </p>
            {error.stack && (
              <details className="mt-2">
                <summary className="text-gray-500 text-xs cursor-pointer hover:text-gray-400">
                  자세한 정보
                </summary>
                <pre className="text-gray-500 text-xs mt-2 overflow-x-auto">
                  {error.stack}
                </pre>
              </details>
            )}
          </div>

          <button
            onClick={resetErrorBoundary}
            className="w-full py-2.5 sm:py-3 text-sm sm:text-base bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCw size={16} />
            다시 시도
          </button>
        </div>
      </div>
    </div>
  );
}
