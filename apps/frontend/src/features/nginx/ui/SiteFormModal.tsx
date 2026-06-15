import { Server } from 'lucide-react';
import type { CreateNginxSiteDto } from '../lib/nginx.types';

interface FlatUpstream {
  label: string;
  value: string;
  containerName: string;
}

interface SiteFormModalProps {
  editingName: string | null;
  form: CreateNginxSiteDto;
  setForm: (form: CreateNginxSiteDto) => void;
  allUpstreams: FlatUpstream[];
  onSubmit: () => void;
  onClose: () => void;
}

export function SiteFormModal({
  editingName,
  form,
  setForm,
  allUpstreams,
  onSubmit,
  onClose,
}: SiteFormModalProps) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-bold text-white mb-5">
          {editingName ? '사이트 수정' : '새 사이트 추가'}
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              설정 파일 이름
            </label>
            <input
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50"
              placeholder="예: my-app"
              value={form.name}
              disabled={!!editingName}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">도메인</label>
            <input
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              placeholder="예: app.kscold.com"
              value={form.domain}
              onChange={(e) => setForm({ ...form, domain: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Upstream (프록시 대상)
            </label>
            {allUpstreams.length > 0 && (
              <div className="mb-2">
                <p className="text-xs text-gray-500 mb-1.5">
                  <Server size={11} className="inline mr-1" />
                  실행 중인 컨테이너에서 선택:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {allUpstreams.map((u) => (
                    <button
                      key={u.value}
                      type="button"
                      onClick={() => setForm({ ...form, upstream: u.value })}
                      className={`px-2.5 py-1 text-xs rounded-lg border transition ${
                        form.upstream === u.value
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-blue-500'
                      }`}
                    >
                      {u.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      setForm({
                        ...form,
                        upstream: 'http://host.docker.internal:',
                      })
                    }
                    className={`px-2.5 py-1 text-xs rounded-lg border transition ${
                      form.upstream.startsWith('http://host.docker.internal')
                        ? 'bg-purple-600 border-purple-500 text-white'
                        : 'bg-gray-800 border-gray-700 text-purple-300 hover:border-purple-500'
                    }`}
                  >
                    Mac 호스트
                  </button>
                </div>
              </div>
            )}
            <input
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              placeholder="예: http://ubuntu-galjido:8080"
              value={form.upstream}
              onChange={(e) => setForm({ ...form, upstream: e.target.value })}
            />
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.ssl}
                onChange={(e) => setForm({ ...form, ssl: e.target.checked })}
                className="w-4 h-4 rounded"
              />
              <span className="text-sm text-gray-300">SSL (HTTPS)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.websocket}
                onChange={(e) =>
                  setForm({ ...form, websocket: e.target.checked })
                }
                className="w-4 h-4 rounded"
              />
              <span className="text-sm text-gray-300">WebSocket</span>
            </label>
          </div>
          {form.ssl && (
            <div className="space-y-3 border border-gray-800 rounded-lg p-3">
              <p className="text-xs text-gray-500">
                SSL 인증서 경로 (비워두면 기본 경로 사용)
              </p>
              <input
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                placeholder={`/etc/nginx/ssl/${form.domain || 'domain'}/fullchain.pem`}
                value={form.sslCert}
                onChange={(e) => setForm({ ...form, sslCert: e.target.value })}
              />
              <input
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                placeholder={`/etc/nginx/ssl/${form.domain || 'domain'}/privkey.pem`}
                value={form.sslKey}
                onChange={(e) => setForm({ ...form, sslKey: e.target.value })}
              />
            </div>
          )}
        </div>
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition text-sm"
          >
            취소
          </button>
          <button
            onClick={onSubmit}
            className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition text-sm font-semibold"
          >
            {editingName ? '저장' : '추가'}
          </button>
        </div>
      </div>
    </div>
  );
}
