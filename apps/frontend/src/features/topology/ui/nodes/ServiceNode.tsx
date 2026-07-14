import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { ServiceNodeData } from '@/entities/container';

export const ServiceNode = memo(function ServiceNode({ data }: NodeProps) {
  const nodeData = data as unknown as ServiceNodeData;

  return (
    <div className="min-w-[120px] rounded-xl border border-violet-500 bg-violet-950/90 px-3 py-2 shadow-lg shadow-violet-500/10">
      <Handle
        type="target"
        position={Position.Top}
        className="!h-2 !w-2 !bg-violet-400"
      />
      <div className="flex items-center gap-2">
        <span className="text-sm leading-none">{nodeData.icon}</span>
        <div>
          <p className="text-xs font-semibold text-white">{nodeData.label}</p>
          <p className="text-[10px] font-mono text-violet-200">
            :{nodeData.port}
          </p>
        </div>
      </div>
    </div>
  );
});
