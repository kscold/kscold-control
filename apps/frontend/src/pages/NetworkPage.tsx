import { useEffect, useState } from 'react';
import {
  Network,
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle,
  XCircle,
  ArrowRight,
  Server,
  Copy,
  AlertTriangle,
} from 'lucide-react';
import { api } from '../lib/api';
import { useModalStore } from '../stores/modal.store';

interface PortMapping {
  publicPort: number;
  privatePort: number;
  protocol: 'TCP' | 'UDP';
  description: string;
  enabled: boolean;
  ttl: number;
  privateHost: string;
  local: boolean;
}

interface CreateMappingForm {
  publicPort: string;
  privatePort: string;
  protocol: 'TCP' | 'UDP';
  description: string;
}

const emptyForm: CreateMappingForm = {
  publicPort: '',
  privatePort: '',
  protocol: 'TCP',
  description: 'kscold-control',
};

export function NetworkPage() {
  const [mappings, setMappings] = useState<PortMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [externalIp, setExternalIp] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<CreateMappingForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>('');

  const { showAlert, showConfirm } = useModalStore();

  useEffect(() => {
    loadMappings();
    loadExternalIp();
  }, []);

  const loadMappings = async () => {
    try {
      setLoading(true);
      setError('');
      const { data } = await api.get('/upnp/mappings');
      setMappings(data);
    } catch (e: any) {
      const msg = e.response?.data?.message || e.message || 'UPnP 조회 실패';
      setError(msg);
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadExternalIp = async () => {
    try {
      const { data } = await api.get('/upnp/external-ip');
      setExternalIp(data.ip);
    } catch (e) {
      console.error('External IP fetch failed', e);
    }
  };

  const handleCreate = async () => {
    const pubPort = parseInt(form.publicPort, 10);
    const privPort = parseInt(form.privatePort, 10);

    if (!pubPort || !privPort || pubPort < 1 || privPort < 1) {
      showAlert('유효한 포트 번호를 입력하세요.');
      return;
    }
    if (pubPort > 65535 || privPort > 65535) {
      showAlert('포트 번호는 65535 이하여야 합니다.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/upnp/mappings', {
        publicPort: pubPort,
        privatePort: privPort,
        protocol: form.protocol,
        description: form.description || 'kscold-control',
      });
      showAlert(`포트 매핑 추가 완료: ${pubPort} -> ${privPort} (${form.protocol})`);
      setShowModal(false);
      setForm(emptyForm);
      await loadMappings();
    } catch (e: any) {
      showAlert(e.response?.data?.message || '포트 매핑 추가 실패');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (mapping: PortMapping) => {
    showConfirm(
      `포트 매핑 ${mapping.publicPort} -> ${mapping.privatePort} (${mapping.protocol})을 삭제하시겠습니까?`,
      async () => {
        try {
          await api.delete(`/upnp/mappings/${mapping.publicPort}?protocol=${mapping.protocol}`);
          await loadMappings();
        } catch (e: any) {
          showAlert(e.response?.data?.message || '포트 매핑 삭제 실패');
        }
      },
      '삭제',
    );
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showAlert('클립보드에 복사되었습니다.');
  };

  return (
    <div className="h-full overflow-auto p-4 sm:p-6 bg-gray-950">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
          <Network size={22} className="text-purple-400" />
          네트워크 관리
        </h2>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={loadMappings}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition disabled:opacity-50"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            새로고침
          </button>
          <button
            onClick={() => {
              setForm(emptyForm);
              setShowModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition"
          >
            <Plus size={15} />
            포트 매핑 추가
          </button>
        </div>
      </div>

      {/* External IP + Info */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 flex items-center gap-3">
          <Server size={16} className="text-purple-400" />
          <div>
            <p className="text-xs text-gray-500">공유기 외부 IP (UPnP)</p>
            <div className="flex items-center gap-2">
              <span className="text-white font-mono font-semibold">{externalIp || '...'}</span>
              {externalIp && (
                <button onClick={() => copyToClipboard(externalIp)} className="text-gray-500 hover:text-white transition" title="복사">
                  <Copy size={13} />
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 flex items-center gap-3">
          <Network size={16} className="text-blue-400" />
          <div>
            <p className="text-xs text-gray-500">활성 매핑 수</p>
            <span className="text-white font-semibold">{mappings.length}개</span>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 rounded-lg border bg-red-950 border-red-700 text-red-300 text-sm flex items-center gap-2">
          <AlertTriangle size={16} />
          <div>
            <p className="font-semibold">UPnP 연결 실패</p>
            <p className="text-xs text-red-400 mt-0.5">{error}</p>
            <p className="text-xs text-red-400/70 mt-1">공유기에서 UPnP가 활성화되어 있는지 확인하세요.</p>
          </div>
        </div>
      )}

      {/* Mappings List */}
      {loading ? (
        <div className="text-gray-500 text-center py-12">UPnP 매핑 조회 중...</div>
      ) : mappings.length === 0 && !error ? (
        <div className="text-gray-500 text-center py-12">등록된 포트 매핑이 없습니다.</div>
      ) : (
        <div className="grid gap-2">
          {/* Header */}
          {mappings.length > 0 && (
            <div className="grid grid-cols-[auto_80px_1fr_80px_1fr_1fr_auto] gap-3 px-4 py-2 text-xs text-gray-500 font-medium">
              <span></span>
              <span>프로토콜</span>
              <span>외부 포트</span>
              <span></span>
              <span>내부 포트</span>
              <span>설명</span>
              <span></span>
            </div>
          )}

          {mappings.map((m, i) => (
            <div
              key={`${m.publicPort}-${m.protocol}-${i}`}
              className={`bg-gray-900 border rounded-xl px-4 py-3 grid grid-cols-[auto_80px_1fr_80px_1fr_1fr_auto] gap-3 items-center ${
                m.local ? 'border-purple-800/50' : 'border-gray-700'
              }`}
            >
              <div
                className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                  m.enabled ? 'bg-green-400' : 'bg-gray-600'
                }`}
              />
              <span
                className={`text-xs font-mono px-2 py-0.5 rounded text-center ${
                  m.protocol === 'TCP'
                    ? 'bg-blue-950 text-blue-400'
                    : 'bg-orange-950 text-orange-400'
                }`}
              >
                {m.protocol}
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-white font-mono font-semibold">{m.publicPort}</span>
              </div>
              <div className="flex justify-center">
                <ArrowRight size={14} className="text-gray-600" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-white font-mono">{m.privateHost}:{m.privatePort}</span>
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-gray-400 text-sm truncate">{m.description}</span>
                {m.local && (
                  <span className="text-xs bg-purple-950 text-purple-400 px-1.5 py-0.5 rounded flex-shrink-0">
                    로컬
                  </span>
                )}
              </div>
              <button
                onClick={() => handleDelete(m)}
                className="p-1.5 rounded-lg text-red-400 hover:bg-red-950 transition"
                title="삭제"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
              <Network size={18} className="text-purple-400" />
              포트 매핑 추가
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">외부 포트</label>
                  <input
                    type="number"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                    placeholder="예: 8080"
                    value={form.publicPort}
                    onChange={(e) => setForm({ ...form, publicPort: e.target.value })}
                    min="1"
                    max="65535"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">내부 포트</label>
                  <input
                    type="number"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                    placeholder="예: 8080"
                    value={form.privatePort}
                    onChange={(e) => setForm({ ...form, privatePort: e.target.value })}
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
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3 text-xs text-gray-400">
                <p>외부에서 <span className="text-white font-mono">{externalIp || '공인IP'}:{form.publicPort || '?'}</span> 접속 시</p>
                <p>로컬 <span className="text-white font-mono">이 서버:{form.privatePort || '?'}</span> 로 포워딩됩니다.</p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                disabled={submitting}
                className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition text-sm disabled:opacity-50"
              >
                취소
              </button>
              <button
                onClick={handleCreate}
                disabled={submitting}
                className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition text-sm font-semibold disabled:opacity-50"
              >
                {submitting ? '추가 중...' : '추가'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
