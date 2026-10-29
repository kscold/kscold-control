import {
  Network,
  Plus,
  RefreshCw,
  Server,
  Copy,
  AlertTriangle,
  Info,
  LockKeyhole,
} from 'lucide-react';
import { usePortMappings } from '../model/usePortMappings';
import { useExternalIp } from '../model/useExternalIp';
import { PortMappingList } from './PortMappingList';
import { CreateMappingModal } from './CreateMappingModal';

function QueryStatus({
  loading,
  error,
  updatedAt,
}: {
  loading: boolean;
  error: string;
  updatedAt: Date | null;
}) {
  return (
    <p className="mt-2 text-xs text-gray-400" role="status">
      {loading
        ? '조회 중 · 최대 45초'
        : error
          ? updatedAt
            ? '이전 결과 · 현재 상태 미확인'
            : '조회 실패 · 상태 미확인'
          : '조회 완료'}
      {updatedAt && (
        <span className="ml-2">
          마지막 성공 {updatedAt.toLocaleTimeString('ko-KR')}
        </span>
      )}
    </p>
  );
}

export function NetworkDashboard() {
  const mapping = usePortMappings();
  const ip = useExternalIp();
  const refreshing = mapping.loading || ip.loading;
  const refresh = () => {
    void mapping.loadMappings();
    void ip.reload();
  };

  return (
    <div
      className="h-full overflow-auto bg-gray-950 p-4 sm:p-6"
      data-testid="network-dashboard"
    >
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-white sm:text-2xl">
            <Network size={22} className="text-blue-400" />
            네트워크 관리
          </h2>
          <p className="mt-2 text-sm text-gray-400">
            공유기 연결 상태와 UPnP 동적 포트 매핑
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={refresh}
            disabled={refreshing}
            className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 hover:bg-gray-800 disabled:opacity-50"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? '확인 중' : '상태 새로고침'}
          </button>
          {mapping.canWrite && (
            <button
              onClick={mapping.openModal}
              disabled={!mapping.canMutate}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus size={15} />
              포트 매핑 추가
            </button>
          )}
        </div>
      </header>

      {!mapping.canWrite && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-gray-800 px-3 py-2 text-sm text-gray-400">
          <LockKeyhole size={15} />
          읽기 전용 · 포트 매핑을 변경할 수 없습니다.
        </div>
      )}

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <section
          className="min-w-0 rounded-xl border border-gray-800 bg-gray-900 p-4"
          aria-label="외부 IP 상태"
        >
          <h3 className="flex items-center gap-2 text-sm text-gray-400">
            <Server size={16} className="text-blue-400" />
            공유기 외부 IP
          </h3>
          <div className="mt-3 flex items-center gap-3">
            <span
              className={`min-w-0 break-all font-mono text-xl font-semibold ${ip.error ? 'text-gray-400' : 'text-white'}`}
            >
              {ip.data || (ip.loading ? '확인 중' : '확인 불가')}
            </span>
            {ip.data && !ip.error && !ip.loading && (
              <button
                onClick={() => void mapping.copyToClipboard(ip.data)}
                aria-label="외부 IP 복사"
                className="shrink-0 rounded p-2 text-gray-400 hover:bg-gray-800 hover:text-white"
              >
                <Copy size={16} />
              </button>
            )}
          </div>
          <QueryStatus
            loading={ip.loading}
            error={ip.error}
            updatedAt={ip.updatedAt}
          />
        </section>
        <section
          className="min-w-0 rounded-xl border border-gray-800 bg-gray-900 p-4"
          aria-label="포트 매핑 상태"
        >
          <h3 className="flex items-center gap-2 text-sm text-gray-400">
            <Network size={16} className="text-blue-400" />
            동적 매핑
          </h3>
          <p
            className={`mt-3 text-xl font-semibold ${mapping.error ? 'text-gray-400' : 'text-white'}`}
          >
            {mapping.updatedAt
              ? `${mapping.mappings.length}개`
              : mapping.loading
                ? '확인 중'
                : '확인 불가'}
          </p>
          <QueryStatus
            loading={mapping.loading}
            error={mapping.error}
            updatedAt={mapping.updatedAt}
          />
        </section>
      </div>

      {(mapping.error || ip.error) && (
        <section
          role="alert"
          className="mb-4 rounded-xl border border-amber-700/50 bg-amber-950/20 p-4 text-sm text-amber-200"
        >
          <h3 className="mb-2 flex items-center gap-2 font-semibold">
            <AlertTriangle size={17} />
            일부 네트워크 상태를 확인하지 못했습니다
          </h3>
          {ip.error && <p className="break-words">외부 IP: {ip.error}</p>}
          {mapping.error && (
            <p className="mt-1 break-words">포트 목록: {mapping.error}</p>
          )}
          <p className="mt-3 text-xs text-amber-200/80">
            조회 실패만으로 서비스 중단이나 포트 삭제를 의미하지 않습니다. 기존
            설정은 변경하지 않았습니다.
          </p>
          <button
            onClick={refresh}
            disabled={refreshing}
            className="mt-3 rounded-lg border border-amber-700 px-3 py-2 font-medium hover:bg-amber-900/30 disabled:opacity-50"
          >
            다시 조회
          </button>
        </section>
      )}

      <details className="mb-5 rounded-xl border border-gray-800 bg-gray-900/40 p-4 text-sm text-gray-400">
        <summary className="cursor-pointer text-gray-300">
          <Info size={15} className="mr-2 inline-block text-blue-400" />
          무엇이 표시되나요? 연결 문제 확인하기
        </summary>
        <div className="mt-3 space-y-2 leading-relaxed">
          <p>
            이 화면은 UPnP 동적 매핑만 조회합니다. 공유기에 직접 등록한 정적
            포트포워딩과 Docker 포트는 포함하지 않습니다.
          </p>
          <p>
            공유기에서 UPnP가 활성화되어 있는지, Control 서버가 공유기와 같은
            네트워크인지 확인하세요. VM·Docker·방화벽이 SSDP 탐색을 차단할 수
            있습니다.
          </p>
          <p>
            UPnP를 사용할 수 없는 환경에서는 공유기 관리 화면에서 확인하세요.
            임의로 방화벽을 해제하거나 기존 매핑을 변경하지 마세요.
          </p>
        </div>
      </details>

      <section aria-labelledby="mappings-title">
        <h3
          id="mappings-title"
          className="mb-3 text-base font-semibold text-white"
        >
          포트 매핑 목록
        </h3>
        <PortMappingList
          mappings={mapping.mappings}
          loading={mapping.loading}
          error={mapping.error}
          onDelete={mapping.handleDelete}
          canWrite={mapping.canWrite}
          canMutate={Boolean(mapping.canMutate)}
          deleting={mapping.deleting}
        />
      </section>

      {mapping.showModal && (
        <CreateMappingModal
          form={mapping.form}
          setForm={mapping.setForm}
          submitting={mapping.submitting}
          canSubmit={Boolean(mapping.canMutate)}
          externalIp={ip.error ? '' : ip.data}
          onSubmit={() => void mapping.handleCreate()}
          onClose={mapping.closeModal}
        />
      )}
    </div>
  );
}
