import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Server } from 'lucide-react';
import type { HostNodeData } from '@/entities/container';

export const HostNode = memo(function HostNode({ data }: NodeProps) {
  const d = data as unknown as HostNodeData;
  return (
    <div className="bg-gray-800 border-2 border-blue-500 rounded-2xl shadow-lg shadow-blue-500/15 min-w-[220px]">
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-blue-500 !w-3 !h-3"
      />
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-blue-500 !w-3 !h-3"
      />
      <div className="bg-blue-950 rounded-t-2xl px-4 py-2.5 flex items-center gap-2">
        <Server size={15} className="text-blue-400" />
        <span className="text-white font-bold text-sm">{d.label}</span>
        <span className="ml-auto text-[9px] bg-blue-800 text-blue-300 px-1.5 py-0.5 rounded">
          HOST
        </span>
      </div>
      <div className="px-4 py-2.5">
        <div className="flex flex-wrap gap-1 mb-2">
          {[
            { t: 'macOS', c: 'bg-gray-700 text-gray-300' },
            { t: 'Colima', c: 'bg-gray-700 text-gray-300' },
            { t: 'Docker', c: 'bg-blue-900 text-blue-300' },
          ].map((b) => (
            <span
              key={b.t}
              className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${b.c}`}
            >
              {b.t}
            </span>
          ))}
        </div>
        <p className="text-[10px] text-gray-400">{d.subtitle}</p>
      </div>
    </div>
  );
});
