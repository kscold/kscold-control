import { Trash2, ArrowRight } from 'lucide-react';
import type { PortMapping } from '../model/network.types';

interface PortMappingListProps {
  mappings: PortMapping[];
  loading: boolean;
  error: string;
  onDelete: (mapping: PortMapping) => void;
}

export function PortMappingList({
  mappings,
  loading,
  error,
  onDelete,
}: PortMappingListProps) {
  if (loading) {
    return (
      <div className="text-gray-500 text-center py-12">
        UPnP 매핑 조회 중...
      </div>
    );
  }

  if (mappings.length === 0 && !error) {
    return (
      <div className="text-gray-500 text-center py-12">
        등록된 포트 매핑이 없습니다.
      </div>
    );
  }

  return (
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
            <span className="text-white font-mono font-semibold">
              {m.publicPort}
            </span>
          </div>
          <div className="flex justify-center">
            <ArrowRight size={14} className="text-gray-600" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-white font-mono">
              {m.privateHost}:{m.privatePort}
            </span>
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-gray-400 text-sm truncate">
              {m.description}
            </span>
            {m.local && (
              <span className="text-xs bg-purple-950 text-purple-400 px-1.5 py-0.5 rounded flex-shrink-0">
                로컬
              </span>
            )}
          </div>
          <button
            onClick={() => onDelete(m)}
            className="p-1.5 rounded-lg text-red-400 hover:bg-red-950 transition"
            title="삭제"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ))}
    </div>
  );
}
