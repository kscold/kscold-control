import { MapPin, ShieldOff, UserCheck } from 'lucide-react';
import type { SshAccessOverview } from '../model/security.types';

interface CurrentIpBannerProps {
  data: SshAccessOverview;
  canManage: boolean;
  onAddKnown: (ip: string) => void;
  onUnblock: (ip: string) => void;
}

/** 루프백·사설망·테일스케일(100.64/10) 주소 */
const INTERNAL_IP =
  /^(127\.|::1$|::ffff:127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/;

/**
 * 해외·휴대폰에서 가장 먼저 궁금한 것: 지금 내 주소가 막혀 있는지, 내 IP 로 등록돼 있는지.
 * 맨 위에서 바로 등록·해제할 수 있게 한다.
 */
export function CurrentIpBanner({
  data,
  canManage,
  onAddKnown,
  onUnblock,
}: CurrentIpBannerProps) {
  const ip = data.requesterIp;
  if (!ip) return null;
  // 테일스케일·내부망·같은 기기에서 열면 서버에는 내부 주소로 보인다. 차단기가 막지 않는 주소라 등록할 필요가 없다
  const internal = INTERNAL_IP.test(ip);
  const known = data.knownIps.some((k) => k.ip === ip);
  const blocked = data.blocks.some((b) => b.ip === ip);
  const tone = blocked
    ? 'border-red-500/40 bg-red-950/30'
    : known
      ? 'border-emerald-500/30 bg-emerald-950/20'
      : 'border-gray-800 bg-gray-900';

  return (
    <div
      className={`flex flex-wrap items-center gap-2 rounded-xl border p-3 ${tone}`}
    >
      <MapPin size={16} className="shrink-0 text-gray-400" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-gray-400">지금 접속한 IP</p>
        <p className="font-mono text-sm text-white">
          {ip}{' '}
          <span
            className={`font-sans text-xs ${blocked ? 'text-red-300' : known ? 'text-emerald-300' : 'text-gray-400'}`}
          >
            {internal
              ? '내부 주소 · 막히지 않음'
              : blocked
                ? '차단됨'
                : known
                  ? '내 IP'
                  : '등록 안 됨'}
          </span>
        </p>
      </div>
      {canManage && blocked && (
        <button
          type="button"
          onClick={() => onUnblock(ip)}
          className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-2 text-xs text-white hover:bg-red-500"
        >
          <ShieldOff size={14} /> 차단 해제
        </button>
      )}
      {canManage && !known && !internal && (
        <button
          type="button"
          onClick={() => onAddKnown(ip)}
          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs text-white hover:bg-emerald-500"
        >
          <UserCheck size={14} /> 내 IP 로 등록
        </button>
      )}
    </div>
  );
}
