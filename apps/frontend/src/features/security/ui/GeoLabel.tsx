import type { IpGeo } from '../model/security.types';
import { flagEmoji } from '../lib/flag';

/** IP 옆에 붙이는 국기·나라·도시. 위치를 모르면 아무것도 그리지 않는다. */
export function GeoLabel({ geo }: { geo: IpGeo | null | undefined }) {
  if (!geo) return null;
  const place = geo.city ? `${geo.countryName} ${geo.city}` : geo.countryName;
  return (
    <span
      title={place}
      className="inline-flex min-w-0 max-w-full items-center gap-1 text-xs text-gray-400"
    >
      <span aria-hidden="true">{flagEmoji(geo.country)}</span>
      <span className="truncate">{place}</span>
    </span>
  );
}
