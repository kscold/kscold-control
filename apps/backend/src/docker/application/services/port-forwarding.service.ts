import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  type IUpnpGatewayRepository,
  UPNP_GATEWAY_REPOSITORY,
} from '../../../upnp/domain/repositories/upnp-gateway.repository';

/**
 * 컨테이너 외부 접속에 필요한 UPnP 포트 매핑 관리함.
 *
 * Docker 포트 공개와 라우터 포트 매핑은 별개이므로, 컨테이너 생성·삭제 흐름에서
 * 이 서비스를 통해 라우터 규칙도 함께 등록하거나 제거함.
 */
@Injectable()
export class PortForwardingService {
  private readonly logger = new Logger(PortForwardingService.name);
  private externalIp: string | null = null;
  private readonly domain = 'kscold.iptime.org'; // 외부 접속 안내에 쓰는 고정 도메인

  constructor(
    @Inject(UPNP_GATEWAY_REPOSITORY)
    private readonly gateway: IUpnpGatewayRepository,
  ) {
    this.initializeExternalIp();
  }

  /**
   * 외부 IP를 한 번 조회해 캐시함.
   *
   * 조회 실패는 컨테이너 생성 자체를 막지 않아야 하므로, 주소 대신 고정 도메인을
   * 사용해 외부 접속 문자열은 계속 만들 수 있게 함.
   */
  private initializeExternalIp() {
    void this.gateway
      .getExternalIp()
      .then((ip) => {
        this.externalIp = ip;
        this.logger.log(`외부 IP를 확인했습니다: ${this.externalIp}`);
      })
      .catch(() => {
        this.logger.warn(
          'UPnP 외부 IP 조회에 실패해 고정 도메인을 사용합니다.',
        );
        this.externalIp = this.domain;
      });
  }

  /**
   * 라우터에 단일 포트 매핑 추가함.
   */
  async addPortMapping(
    internalPort: number,
    externalPort: number,
    description: string,
  ): Promise<void> {
    try {
      await this.gateway.addMapping({
        publicPort: externalPort,
        privatePort: internalPort,
        description,
      });
      this.logger.log(
        `포트 포워딩을 추가했습니다: ${externalPort} -> ${internalPort} (${description})`,
      );
    } catch (error) {
      this.logger.error(
        `포트 포워딩 추가에 실패했습니다: ${externalPort} -> ${internalPort}, ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * 라우터에서 단일 포트 매핑 제거함.
   */
  async removePortMapping(externalPort: number): Promise<void> {
    try {
      await this.gateway.removeMapping(externalPort, 'TCP');
      this.logger.log(`포트 포워딩을 제거했습니다: ${externalPort}`);
    } catch (error) {
      this.logger.error(
        `포트 포워딩 제거에 실패했습니다: ${externalPort}, ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * 컨테이너가 공개한 모든 포트를 라우터에 등록함.
   *
   * 설명자에 컨테이너 이름과 내부 포트를 기록해 삭제 시 DB 외 상태를 별도로
   * 저장하지 않아도 이 컨테이너가 만든 규칙만 찾아낼 수 있게 함.
   */
  async addPortForwardingRules(
    containerName: string,
    ports: Record<string, number>,
  ): Promise<void> {
    const promises = Object.entries(ports).map(([internalPort, externalPort]) =>
      this.addPortMapping(
        parseInt(internalPort),
        externalPort,
        `${containerName}-${internalPort}`,
      ),
    );

    await Promise.all(promises);
  }

  /**
   * 컨테이너가 만든 모든 라우터 포트 매핑 제거함.
   *
   * 이전 구현은 소유 포트를 알 수 없어 아무 작업도 하지 않았습니다. 추가할 때
   * 남긴 "${containerName}-내부포트" 설명자를 기준으로 라우터 목록을 조회해
   * 정확히 일치하는 접두사의 규칙만 제거함. 하나의 삭제가 실패해도 나머지
   * 규칙은 계속 정리하고, 컨테이너 DB 삭제를 막지 않도록 오류는 기록만 남김.
   */
  async removePortForwardingRules(containerName: string): Promise<void> {
    const descriptionPrefix = `${containerName}-`;

    try {
      const mappings = await this.gateway.getMappings();
      const ownedMappings = mappings.filter((mapping) =>
        mapping.description.startsWith(descriptionPrefix),
      );
      const results = await Promise.allSettled(
        ownedMappings.map((mapping) =>
          this.gateway.removeMapping(mapping.publicPort, mapping.protocol),
        ),
      );
      const failedCount = results.filter(
        (result) => result.status === 'rejected',
      ).length;

      if (failedCount > 0) {
        this.logger.warn(
          `${containerName}의 포트 포워딩 ${failedCount}건을 제거하지 못했습니다.`,
        );
        return;
      }

      this.logger.log(
        `${containerName}의 포트 포워딩 ${ownedMappings.length}건을 제거했습니다.`,
      );
    } catch (error) {
      this.logger.error(
        `${containerName}의 포트 포워딩 목록 조회에 실패했습니다: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * 공개 포트에서 외부 접속 안내 문자열을 만듭니다.
   */
  getExternalAccess(ports: Record<string, number>): {
    ssh?: string;
    http?: string;
    domain: string;
  } {
    // 반환 타입이 이미 선언돼 있으므로 지역 변수에 any 를 둘 이유가 없다.
    const result: { ssh?: string; http?: string; domain: string } = {
      domain: this.domain,
    };

    // SSH 내부 포트 22가 공개된 경우에만 접속 명령 제공함.
    if (ports['22']) {
      result.ssh = `ssh root@${this.domain} -p ${ports['22']}`;
    }

    // HTTP 내부 포트 80이 공개된 경우에만 URL 제공함.
    if (ports['80']) {
      result.http = `http://${this.domain}:${ports['80']}`;
    }

    return result;
  }

  /**
   * 서비스 종료 시 호출되는 정리 지점임.
   */
  async close(): Promise<void> {
    this.logger.log('UPnP client closed');
  }
}
