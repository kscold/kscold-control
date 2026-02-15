import { Injectable, Logger } from '@nestjs/common';
import NatAPI = require('nat-api');

@Injectable()
export class PortForwardingService {
  private readonly logger = new Logger(PortForwardingService.name);
  private client: any;
  private externalIp: string | null = null;
  private readonly domain = 'kscold.iptime.org'; // 고정 도메인

  constructor() {
    this.client = new NatAPI({ ttl: 0 }); // 0 = 영구
    this.initializeExternalIp();
  }

  /**
   * 외부 IP 조회 (한 번만 실행)
   */
  private initializeExternalIp() {
    this.client.externalIp((err: Error, ip: string) => {
      if (err) {
        this.logger.warn(
          'Failed to get external IP via UPnP, using domain instead',
        );
        this.externalIp = this.domain;
      } else {
        this.externalIp = ip;
        this.logger.log(`External IP: ${this.externalIp}`);
      }
    });
  }

  /**
   * 포트포워딩 규칙 추가
   */
  async addPortMapping(
    internalPort: number,
    externalPort: number,
    description: string,
  ): Promise<void> {
    return new Promise((resolve) => {
      this.client.map(
        {
          publicPort: externalPort,
          privatePort: internalPort,
          ttl: 0,
          description,
        },
        (err: Error) => {
          if (err) {
            this.logger.error(
              `Failed to add port mapping ${externalPort} -> ${internalPort}: ${err.message}`,
            );
          } else {
            this.logger.log(
              `Port forwarding added: ${externalPort} -> ${internalPort} (${description})`,
            );
          }
          // UPnP 실패해도 컨테이너 생성은 계속 진행
          resolve();
        },
      );
    });
  }

  /**
   * 포트포워딩 규칙 제거
   */
  async removePortMapping(externalPort: number): Promise<void> {
    return new Promise((resolve) => {
      this.client.unmap(externalPort, (err: Error) => {
        if (err) {
          this.logger.error(
            `Failed to remove port mapping ${externalPort}: ${err.message}`,
          );
        } else {
          this.logger.log(`Port forwarding removed: ${externalPort}`);
        }
        resolve();
      });
    });
  }

  /**
   * 외부 접속 정보 생성
   */
  getExternalAccess(ports: Record<string, number>): {
    ssh?: string;
    http?: string;
    domain: string;
  } {
    const result: any = { domain: this.domain };

    // SSH 포트 (22번)
    if (ports['22']) {
      result.ssh = `ssh root@${this.domain} -p ${ports['22']}`;
    }

    // HTTP 포트 (80번)
    if (ports['80']) {
      result.http = `http://${this.domain}:${ports['80']}`;
    }

    return result;
  }

  /**
   * UPnP 연결 종료
   */
  async close(): Promise<void> {
    return new Promise((resolve) => {
      this.client.destroy();
      this.logger.log('UPnP client closed');
      resolve();
    });
  }
}
