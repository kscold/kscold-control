import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Wifi } from 'lucide-react';

export const InternetNode = memo(function InternetNode({ data }: NodeProps) {
  return (
    <div className="bg-gradient-to-br from-indigo-900 to-purple-900 border-2 border-indigo-500 rounded-2xl px-5 py-4 min-w-[160px] shadow-lg shadow-indigo-500/20">
      <Handle type="source" position={Position.Bottom} className="!bg-indigo-400 !w-3 !h-3" />
      <div className="flex items-center gap-2">
        <Wifi size={18} className="text-indigo-300" />
        <div>
          <p className="text-white font-bold text-sm">Internet</p>
          <p className="text-indigo-300 text-[10px]">External Traffic</p>
        </div>
      </div>
    </div>
  );
});
