import { useNavigate } from 'react-router-dom';
import { Terminal, Container } from 'lucide-react';

export function QuickActions() {
  const navigate = useNavigate();

  return (
    <>
      <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">
        Quick Actions
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pb-6">
        <button
          onClick={() => navigate('/terminal')}
          className="flex items-center gap-3 sm:gap-4 p-4 sm:p-5 bg-gray-900 border border-gray-800 rounded-xl hover:border-blue-600 transition active:scale-95"
        >
          <Terminal size={28} className="text-blue-400 flex-shrink-0" />
          <div className="text-left min-w-0">
            <p className="text-white font-semibold text-sm sm:text-base">
              Terminal
            </p>
            <p className="text-gray-500 text-xs sm:text-sm truncate">
              Mac Mini 터미널 접속
            </p>
          </div>
        </button>

        <button
          onClick={() => navigate('/docker')}
          className="flex items-center gap-3 sm:gap-4 p-4 sm:p-5 bg-gray-900 border border-gray-800 rounded-xl hover:border-blue-600 transition active:scale-95"
        >
          <Container size={28} className="text-green-400 flex-shrink-0" />
          <div className="text-left min-w-0">
            <p className="text-white font-semibold text-sm sm:text-base">
              Docker Manager
            </p>
            <p className="text-gray-500 text-xs sm:text-sm truncate">
              Create and manage containers
            </p>
          </div>
        </button>
      </div>
    </>
  );
}
