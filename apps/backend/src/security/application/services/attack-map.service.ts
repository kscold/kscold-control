import { Inject, Injectable } from '@nestjs/common';
import {
  buildAttackMap,
  type AttackCountry,
  type AttackPoint,
} from '../../domain/attack-map/attack-map.model';
import { parseIpRange, rangeContains } from '../../domain/ip-range';
import {
  IP_BAN_REPOSITORY,
  type IIpBanRepository,
} from '../../domain/repositories/ip-ban.repository';
import {
  IP_GEO_READER,
  externalGeo,
  type IIpGeoReader,
  type IpGeoStatus,
} from '../../domain/repositories/ip-geo.reader';
import {
  LOGIN_ATTEMPT_REPOSITORY,
  type ILoginAttemptRepository,
} from '../../domain/repositories/login-attempt.repository';
import { SshAccessService, formatLocal, sinceDate } from './ssh-access.service';

export type AttackMapView =
  | { enabled: false; reason: Exclude<IpGeoStatus['state'], 'ready'> }
  | {
      enabled: true;
      /** IP 위치 파일을 만든 날 */
      builtAt: string;
      since: string;
      points: AttackPoint[];
      countries: AttackCountry[];
    };

/**
 * 공격 지도 — SSH 기록과 Control 로그인 실패를 IP 위치 파일로 나라·도시에 놓는다.
 * 차단 여부는 방화벽(SSH 차단기) 목록과 nginx 차단을 모두 본다.
 */
@Injectable()
export class AttackMapService {
  constructor(
    private readonly ssh: SshAccessService,
    @Inject(LOGIN_ATTEMPT_REPOSITORY)
    private readonly attempts: ILoginAttemptRepository,
    @Inject(IP_BAN_REPOSITORY) private readonly bans: IIpBanRepository,
    @Inject(IP_GEO_READER) private readonly geo: IIpGeoReader,
  ) {}

  async attackMap(days: number): Promise<AttackMapView> {
    const status = this.geo.status();
    if (status.state !== 'ready') {
      return { enabled: false, reason: status.state };
    }
    const [activity, web, bans] = await Promise.all([
      this.ssh.ipActivity(days),
      this.attempts.failuresByIp(sinceDate(days)),
      this.bans.listActive(),
    ]);
    const blocked = [
      ...activity.blocks.map((b) => b.ip),
      ...bans.map((b) => b.ip),
    ];
    const exact = new Set(blocked);
    const ranges = blocked
      .filter((v) => v.includes('/'))
      .flatMap((v) => parseIpRange(v) ?? []);

    return {
      enabled: true,
      builtAt: status.builtAt,
      since: activity.since,
      ...buildAttackMap({
        ssh: activity.ips,
        web: web.map((w) => ({ ...w, lastAt: formatLocal(w.lastAt) })),
        knownIps: new Set(activity.knownIps),
        isBlocked: (ip) =>
          exact.has(ip) || ranges.some((range) => rangeContains(range, ip)),
        geoOf: (ip) => externalGeo(this.geo, ip),
      }),
    };
  }
}
