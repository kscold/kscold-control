import { useEffect } from 'react';
import {
  Network,
  Plus,
  RefreshCw,
  Server,
  Copy,
  AlertTriangle,
  ExternalLink,
  Info,
} from 'lucide-react';
import { usePortMappings } from '../model/usePortMappings';
import { useExternalIp } from '../model/useExternalIp';
import { PortMappingList } from './PortMappingList';
import { CreateMappingModal } from './CreateMappingModal';

export function NetworkDashboard() {
  const {
    mappings,
    loading,
    showModal,
    form,
    submitting,
    error,
    setForm,
    loadMappings,
    handleCreate,
    handleDelete,
    openModal,
    closeModal,
    copyToClipboard,
  } = usePortMappings();

  const { externalIp, loadExternalIp } = useExternalIp();

  useEffect(() => {
    loadMappings();
    loadExternalIp();
  }, []);

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
            onClick={openModal}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition"
          >
            <Plus size={15} />
            포트 매핑 추가
          </button>
        </div>
      </div>

      {/* Static forwarding notice */}
      <div className="mb-4 p-3 rounded-xl border border-blue-900/40 bg-blue-950/20 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <Info size={15} className="text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-blue-300">
            <span className="font-semibold">UPnP 동적 매핑만 표시됩니다.</span>
            <span className="text-blue-400/80 ml-1">
              iptime 관리자 페이지에서 수동 설정한 정적 포트포워딩은 UPnP
              프로토콜로 조회되지 않습니다. 정적 규칙은 공유기 관리 페이지에서
              확인하세요.
            </span>
          </div>
        </div>
        <a
          href="http://192.168.0.1"
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-900/40 hover:bg-blue-900/60 text-blue-300 rounded-lg transition"
        >
          <ExternalLink size={12} />
          공유기 관리 (192.168.0.1)
        </a>
      </div>

      {/* External IP + Info */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 flex items-center gap-3">
          <Server size={16} className="text-purple-400" />
          <div>
            <p className="text-xs text-gray-500">공유기 외부 IP (UPnP)</p>
            <div className="flex items-center gap-2">
              <span className="text-white font-mono font-semibold">
                {externalIp || '...'}
              </span>
              {externalIp && (
                <button
                  onClick={() => copyToClipboard(externalIp)}
                  className="text-gray-500 hover:text-white transition"
                  title="복사"
                >
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
            <span className="text-white font-semibold">
              {mappings.length}개
            </span>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 rounded-lg border bg-yellow-950 border-yellow-700 text-yellow-300 text-sm flex items-center gap-2">
          <AlertTriangle size={16} />
          <div>
            <p className="font-semibold">포트 목록 조회 미지원</p>
            <p className="text-xs text-yellow-400 mt-0.5">
              이 공유기는 UPnP 포트 목록 조회를 지원하지 않습니다.
            </p>
            <p className="text-xs text-yellow-400/70 mt-1">
              포트 추가/삭제 기능은 정상 작동합니다.
            </p>
          </div>
        </div>
      )}

      {/* Mappings List */}
      <PortMappingList
        mappings={mappings}
        loading={loading}
        error={error}
        onDelete={handleDelete}
      />

      {/* Create Modal */}
      {showModal && (
        <CreateMappingModal
          form={form}
          setForm={setForm}
          submitting={submitting}
          externalIp={externalIp}
          onSubmit={() => handleCreate(externalIp)}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
