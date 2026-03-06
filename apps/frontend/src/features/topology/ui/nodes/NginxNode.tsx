import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Globe, ArrowRight } from 'lucide-react';
import type { NginxSiteData } from '../../lib/topology.types';

export function NginxNode({ data }: NodeProps) {
  const d = data as unknown as NginxSiteData;
  return (
    <div className={`bg-gray-900 border-2 rounded-xl shadow-lg min-w-[180px] ${d.enabled ? 'border-amber-500 shadow-amber-500/15' : 'border-gray-600'}`}>
      <Handle type="target" position={Position.Top} className="!bg-amber-500 !w-2.5 !h-2.5" />
      <Handle type="source" position={Position.Bottom} className="!bg-amber-500 !w-2.5 !h-2.5" />
      <div className="bg-amber-950 rounded-t-xl px-3 py-2 flex items-center gap-2">
        <Globe size={13} className={d.enabled ? 'text-amber-400' : 'text-gray-500'} />
        <span className="text-white font-bold text-xs truncate flex-1">{d.domain}</span>
        <div className="flex gap-1 flex-shrink-0">
          {d.ssl && <span className="text-[9px] bg-green-900 text-green-400 px-1 py-0.5 rounded">SSL</span>}
          {d.websocket && <span className="text-[9px] bg-blue-900 text-blue-400 px-1 py-0.5 rounded">WS</span>}
          {!d.enabled && <span className="text-[9px] bg-gray-800 text-gray-500 px-1 py-0.5 rounded">OFF</span>}
        </div>
      </div>
      <div className="px-3 py-2">
        <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Upstream</p>
        <p className="text-[10px] text-gray-300 font-mono flex items-center gap-1">
          <ArrowRight size={8} className="text-amber-500" />
          {d.upstream}
        </p>
      </div>
    </div>
  );
}
