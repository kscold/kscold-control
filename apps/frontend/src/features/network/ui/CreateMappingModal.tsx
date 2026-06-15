import { Network } from 'lucide-react';
import type { CreateMappingForm } from '../lib/network.types';

interface CreateMappingModalProps {
  form: CreateMappingForm;
  setForm: (form: CreateMappingForm) => void;
  submitting: boolean;
  externalIp: string;
  onSubmit: () => void;
  onClose: () => void;
}

export function CreateMappingModal({
  form,
  setForm,
  submitting,
  externalIp,
  onSubmit,
  onClose,
}: CreateMappingModalProps) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md p-6">
        <h3 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
          <Network size={18} className="text-purple-400" />
          포트 매핑 추가
        </h3>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                외부 포트
              </label>
              <input
                type="number"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                placeholder="예: 8080"
                value={form.publicPort}
                onChange={(e) =>
                  setForm({ ...form, publicPort: e.target.value })
                }
                min="1"
                max="65535"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                내부 포트
              </label>
              <input
                type="number"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                placeholder="예: 8080"
                value={form.privatePort}
                onChange={(e) =>
                  setForm({ ...form, privatePort: e.target.value })
                }
                min="1"
                max="65535"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">프로토콜</label>
            <div className="flex gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={form.protocol === 'TCP'}
                  onChange={() => setForm({ ...form, protocol: 'TCP' })}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-300">TCP</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={form.protocol === 'UDP'}
                  onChange={() => setForm({ ...form, protocol: 'UDP' })}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-300">UDP</span>
              </label>
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">설명</label>
            <input
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
              placeholder="예: Web Server"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3 text-xs text-gray-400">
            <p>
              외부에서{' '}
              <span className="text-white font-mono">
                {externalIp || '공인IP'}:{form.publicPort || '?'}
              </span>{' '}
              접속 시
            </p>
            <p>
              로컬{' '}
              <span className="text-white font-mono">
                이 서버:{form.privatePort || '?'}
              </span>{' '}
              로 포워딩됩니다.
            </p>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition text-sm disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={onSubmit}
            disabled={submitting}
            className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition text-sm font-semibold disabled:opacity-50"
          >
            {submitting ? '추가 중...' : '추가'}
          </button>
        </div>
      </div>
    </div>
  );
}
