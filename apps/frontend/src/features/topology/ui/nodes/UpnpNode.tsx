import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Network, ArrowRight } from 'lucide-react';
import type { UpnpMappingData } from '../../lib/topology.types';

export const UpnpNode = memo(function UpnpNode({ data }: NodeProps) {
  const d = data as unknown as UpnpMappingData;
  return (
    <div className="bg-gray-900 border-2 border-purple-600 rounded-xl px-3 py-2.5 min-w-[130px] shadow-lg shadow-purple-500/10">
      <Handle type="target" position={Position.Top} className="!bg-purple-500 !w-2.5 !h-2.5" />
      <Handle type="source" position={Position.Bottom} className="!bg-purple-500 !w-2.5 !h-2.5" />
      <div className="flex items-center gap-1.5 mb-1">
        <Network size={12} className="text-purple-400" />
        <span className="text-white font-bold text-xs">:{d.publicPort}</span>
        <span className={`ml-auto text-[8px] px-1 py-0.5 rounded font-mono ${d.protocol === 'TCP' ? 'bg-blue-950 text-blue-400' : 'bg-orange-950 text-orange-400'}`}>
          {d.protocol}
        </span>
      </div>
      <p className="text-[9px] text-gray-500 flex items-center gap-1">
        <ArrowRight size={7} className="text-purple-500" />
        :{d.privatePort} {d.description && `· ${d.description}`}
      </p>
    </div>
  );
});
