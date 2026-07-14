import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Cpu, Database } from 'lucide-react';
import type {
  ContainerNodeData,
  Pm2Process,
  SystemService,
} from '@/entities/container';
import { formatMemory, pm2Dot } from '../../lib/topology.utils';

export const ContainerNode = memo(function ContainerNode({ data }: NodeProps) {
  const d = data as unknown as ContainerNodeData;
  const isRunning = d.status === 'running';
  const meta = d.meta;
  const processes = d.processes || { pm2: [], services: [] };

  const pm2List: Pm2Process[] = processes.pm2;
  const runtimeServices: SystemService[] =
    processes.services.length > 0
      ? processes.services
      : meta.knownServices.map((s) => ({ ...s }));

  return (
    <div
      className={`bg-gray-900 border-2 rounded-xl shadow-lg flex flex-col min-w-[220px] max-w-[260px] ${meta.color} ${meta.shadowColor}`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-green-500 !w-2.5 !h-2.5"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-green-500 !w-2.5 !h-2.5"
      />

      {/* Header */}
      <div
        className={`${meta.headerBg} rounded-t-xl px-3 py-2 flex items-center gap-2`}
      >
        <span className="text-white font-bold text-xs truncate flex-1">
          {d.label}
        </span>
        <span
          className={`flex-shrink-0 text-[9px] px-1.5 py-0.5 rounded font-medium ${
            isRunning
              ? 'bg-green-800 text-green-300'
              : 'bg-gray-700 text-gray-400'
          }`}
        >
          {isRunning ? '● Running' : '○ Stopped'}
        </span>
      </div>

      {/* Image */}
      <div className="px-3 pt-2 pb-1">
        <p className="text-[9px] text-gray-500 font-mono truncate">{d.image}</p>
      </div>

      {/* Tech Stack Badges */}
      {meta.stacks.length > 0 && (
        <div className="px-3 pb-2 flex flex-wrap gap-1">
          {meta.stacks.map((s, i) => (
            <span
              key={i}
              className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${s.color}`}
            >
              {s.name}
              {s.badge && <span className="opacity-60 ml-1">{s.badge}</span>}
            </span>
          ))}
        </div>
      )}

      {d.domains && d.domains.length > 0 && (
        <div className="px-3 py-1.5 border-t border-gray-800">
          <p className="text-[8px] text-amber-400 uppercase tracking-wider mb-1">
            Domains
          </p>
          <div className="flex flex-wrap gap-1">
            {d.domains.map((domain) => (
              <span
                key={domain}
                className="text-[9px] bg-amber-950 text-amber-300 px-1.5 py-0.5 rounded font-medium"
              >
                {domain}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Port Mappings */}
      {d.ports && Object.keys(d.ports).length > 0 && (
        <div className="px-3 py-1.5 border-t border-gray-800">
          <p className="text-[8px] text-gray-600 uppercase tracking-wider mb-1">
            Ports
          </p>
          <div className="flex flex-wrap gap-1">
            {Object.entries(d.ports).map(([internal, external]) => (
              <span
                key={internal}
                className="text-[9px] bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded font-mono"
              >
                {String(external)}→{internal}
              </span>
            ))}
          </div>
        </div>
      )}

      {d.gateway && (
        <div className="px-3 py-1.5 border-t border-gray-800">
          <p className="text-[8px] text-cyan-400 uppercase tracking-wider mb-1">
            Web Gateway
          </p>
          <div className="rounded-lg border border-cyan-900/70 bg-cyan-950/40 px-2 py-1.5">
            <p className="text-[10px] font-medium text-cyan-200">
              {d.gateway.label}
            </p>
            <div className="mt-1 space-y-0.5">
              {d.gateway.details.map((detail) => (
                <p
                  key={detail}
                  className="text-[9px] leading-4 text-cyan-100/80"
                >
                  {detail}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PM2 Processes */}
      {pm2List.length > 0 && (
        <div className="px-3 py-1.5 border-t border-gray-800">
          <div className="flex items-center gap-1 mb-1.5">
            <Cpu size={9} className="text-indigo-400" />
            <p className="text-[8px] text-indigo-400 uppercase tracking-wider">
              PM2 Processes
            </p>
          </div>
          {pm2List.map((p, i) => (
            <div key={i} className="flex items-center gap-1.5 mb-1 last:mb-0">
              <span
                className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${pm2Dot(p.status)}`}
              />
              <span className="text-[10px] text-gray-200 font-mono truncate flex-1">
                {p.name}
              </span>
              <div className="flex gap-1 text-[8px] text-gray-500 flex-shrink-0">
                {p.cpu > 0 && <span>{p.cpu.toFixed(0)}%</span>}
                {p.memory > 0 && <span>{formatMemory(p.memory)}</span>}
                {p.restarts > 0 && (
                  <span className="text-yellow-600">↺{p.restarts}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* System Services */}
      {runtimeServices.length > 0 && (
        <div className="px-3 py-1.5 border-t border-gray-800">
          <div className="flex items-center gap-1 mb-1.5">
            <Database size={9} className="text-sky-400" />
            <p className="text-[8px] text-sky-400 uppercase tracking-wider">
              Services
            </p>
          </div>
          {runtimeServices.map((s, i) => (
            <div key={i} className="flex items-center gap-1.5 mb-1 last:mb-0">
              <span className="text-[11px] leading-none">{s.icon}</span>
              <span className="text-[10px] text-gray-300 flex-1">{s.name}</span>
              <span className="text-[9px] text-gray-500 font-mono flex-shrink-0">
                :{s.port}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Stopped state */}
      {!isRunning && (
        <div className="px-3 py-2 border-t border-gray-800 text-center">
          <p className="text-[9px] text-gray-600">컨테이너 중지됨</p>
        </div>
      )}
    </div>
  );
});
