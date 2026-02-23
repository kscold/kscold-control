import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

/**
 * ErrorFallback Component
 * Displays error UI when a component crashes
 */
export function ErrorFallback({
  error,
  resetErrorBoundary,
}: ErrorFallbackProps) {
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
