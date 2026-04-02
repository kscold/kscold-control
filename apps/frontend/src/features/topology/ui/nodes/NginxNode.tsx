import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Globe, ArrowRight, HardDrive } from 'lucide-react';
import type { NginxSiteData } from '../../lib/topology.types';

export const NginxNode = memo(function NginxNode({ data }: NodeProps) {
  const d = data as unknown as NginxSiteData;
  const isMinio = d.name?.includes('minio') || d.domain?.includes('minio');
  const isBucket = d.name?.includes('bucket') || d.domain?.includes('bucket') || d.upstream?.includes('9000');
  const borderColor = isBucket ? 'border-pink-500 shadow-pink-500/15' : isMinio ? 'border-rose-500 shadow-rose-500/15' : 'border-amber-500 shadow-amber-500/15';
  const handleColor = isBucket ? '!bg-pink-500' : isMinio ? '!bg-rose-500' : '!bg-amber-500';
  const headerBg = isBucket ? 'bg-pink-950' : isMinio ? 'bg-rose-950' : 'bg-amber-950';
  const iconColor = isBucket ? 'text-pink-400' : isMinio ? 'text-rose-400' : 'text-amber-400';
  const arrowColor = isBucket ? 'text-pink-500' : isMinio ? 'text-rose-500' : 'text-amber-500';
  const Icon = isMinio || isBucket ? HardDrive : Globe;
  return (
    <div className={`bg-gray-900 border-2 rounded-xl shadow-lg min-w-[180px] ${d.enabled ? borderColor : 'border-gray-600'}`}>
      <Handle type="target" position={Position.Top} className={`${handleColor} !w-2.5 !h-2.5`} />
      <Handle type="source" position={Position.Bottom} className={`${handleColor} !w-2.5 !h-2.5`} />
      <div className={`${headerBg} rounded-t-xl px-3 py-2 flex items-center gap-2`}>
        <Icon size={13} className={d.enabled ? iconColor : 'text-gray-500'} />
        <span className="text-white font-bold text-xs truncate flex-1">{d.domain}</span>
        <div className="flex gap-1 flex-shrink-0">
          {isBucket && <span className="text-[9px] bg-pink-900 text-pink-400 px-1 py-0.5 rounded">Bucket</span>}
          {isMinio && !isBucket && <span className="text-[9px] bg-rose-900 text-rose-400 px-1 py-0.5 rounded">Console</span>}
          {d.ssl && <span className="text-[9px] bg-green-900 text-green-400 px-1 py-0.5 rounded">SSL</span>}
          {d.websocket && <span className="text-[9px] bg-blue-900 text-blue-400 px-1 py-0.5 rounded">WS</span>}
          {!d.enabled && <span className="text-[9px] bg-gray-800 text-gray-500 px-1 py-0.5 rounded">OFF</span>}
        </div>
      </div>
      <div className="px-3 py-2">
        <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Upstream</p>
        <p className="text-[10px] text-gray-300 font-mono flex items-center gap-1">
          <ArrowRight size={8} className={arrowColor} />
          {d.upstream}
        </p>
      </div>
    </div>
  );
});
