import { Lock } from 'lucide-react';

interface SslIssueModalProps {
  certForm: { domain: string; email: string; mode: string };
  setCertForm: (form: { domain: string; email: string; mode: string }) => void;
  issuing: boolean;
  onClose: () => void;
  onSubmit: () => void;
}

export function SslIssueModal({
  certForm,
  setCertForm,
  issuing,
  onClose,
  onSubmit,
}: SslIssueModalProps) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md p-6">
        <h3 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
          <Lock size={18} className="text-green-400" />
          SSL 인증서 발급
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">도메인</label>
            <input
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              placeholder="예: app.kscold.com"
              value={certForm.domain}
              onChange={(e) =>
                setCertForm({ ...certForm, domain: e.target.value })
              }
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              이메일 (Let's Encrypt 알림)
            </label>
            <input
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              placeholder="admin@kscold.com"
              value={certForm.email}
              onChange={(e) =>
                setCertForm({ ...certForm, email: e.target.value })
              }
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              발급 방식
            </label>
            <div className="flex gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={certForm.mode === 'webroot'}
                  onChange={() =>
                    setCertForm({ ...certForm, mode: 'webroot' })
                  }
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-300">Webroot</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={certForm.mode === 'standalone'}
                  onChange={() =>
                    setCertForm({ ...certForm, mode: 'standalone' })
                  }
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-300">Standalone</span>
              </label>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {certForm.mode === 'webroot'
                ? 'Nginx가 실행 중일 때 사용 (도메인이 이미 프록시 설정됨)'
                : 'Nginx 일시 중지 후 발급 (새 도메인)'}
            </p>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={issuing}
            className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition text-sm disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={onSubmit}
            disabled={issuing}
            className="flex-1 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition text-sm font-semibold disabled:opacity-50"
          >
            {issuing ? '발급 중...' : '발급'}
          </button>
        </div>
      </div>
    </div>
  );
}
