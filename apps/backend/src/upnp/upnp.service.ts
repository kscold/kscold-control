import { Injectable, Logger } from '@nestjs/common';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const NatAPI = require('nat-api');

export interface PortMapping {
  publicPort: number;
  privatePort: number;
  protocol: 'TCP' | 'UDP';
  description: string;
  enabled: boolean;
  ttl: number;
  privateHost: string;
  local: boolean;
}

export interface CreateMappingDto {
  publicPort: number;
  privatePort: number;
  protocol?: 'TCP' | 'UDP';
  description?: string;
}

@Injectable()
export class UpnpService {
  private readonly logger = new Logger(UpnpService.name);

  private createClient(): any {
    return new NatAPI({
      ttl: 7200,
      description: 'kscold-control',
      autoUpdate: false,
    });
  }

  async getMappings(): Promise<PortMapping[]> {
    const client = this.createClient();
    try {
      const mappings = await new Promise<any[]>((resolve, reject) => {
        client._upnpClient.getMappings((err: Error, results: any[]) => {
          if (err) return reject(err);
          resolve(results || []);
        });
      });

      return mappings.map((m) => ({
        publicPort: m.public.port,
        privatePort: m.private.port,
        protocol: (m.protocol || 'tcp').toUpperCase() as 'TCP' | 'UDP',
        description: m.description || '',
        enabled: m.enabled !== false,
        ttl: m.ttl || 0,
        privateHost: m.private.host || '',
        local: m.local || false,
      }));
    } catch (err) {
      this.logger.error('Failed to get UPnP mappings', err);
      throw new Error(
        `UPnP 매핑 조회 실패: ${err instanceof Error ? err.message : err}`,
      );
    } finally {
      try {
        client.destroy(() => {});
      } catch {
        // ignore
      }
    }
  }

  async addMapping(dto: CreateMappingDto): Promise<{ success: boolean }> {
    const client = this.createClient();
    const protocol = dto.protocol || 'TCP';

    try {
      await new Promise<void>((resolve, reject) => {
        client.map(
          {
            publicPort: dto.publicPort,
            privatePort: dto.privatePort,
            protocol,
            description: dto.description || 'kscold-control',
            ttl: 7200,
          },
          (err: Error) => {
            if (err) return reject(err);
            resolve();
          },
        );
      });

      this.logger.log(
        `Port mapping added: ${dto.publicPort} -> ${dto.privatePort} (${protocol})`,
      );
      return { success: true };
    } catch (err) {
      this.logger.error('Failed to add UPnP mapping', err);
      throw new Error(
        `포트 매핑 추가 실패: ${err instanceof Error ? err.message : err}`,
      );
    } finally {
      try {
        client.destroy(() => {});
      } catch {
        // ignore
      }
    }
  }

  async removeMapping(
    publicPort: number,
    protocol?: string,
  ): Promise<{ success: boolean }> {
    const client = this.createClient();
    const proto = (protocol || 'TCP').toUpperCase();

    try {
      await new Promise<void>((resolve, reject) => {
        client.unmap(
          {
            publicPort,
            protocol: proto,
          },
          (err: Error) => {
            if (err) return reject(err);
            resolve();
          },
        );
      });

      this.logger.log(`Port mapping removed: ${publicPort} (${proto})`);
      return { success: true };
    } catch (err) {
      this.logger.error('Failed to remove UPnP mapping', err);
      throw new Error(
        `포트 매핑 삭제 실패: ${err instanceof Error ? err.message : err}`,
      );
    } finally {
      try {
        client.destroy(() => {});
      } catch {
        // ignore
      }
    }
  }

  async getExternalIp(): Promise<string> {
    const client = this.createClient();
    try {
      const ip = await new Promise<string>((resolve, reject) => {
        client.externalIp((err: Error, ip: string) => {
          if (err) return reject(err);
          resolve(ip);
        });
      });
      return ip;
    } catch (err) {
      this.logger.error('Failed to get external IP via UPnP', err);
      throw new Error(
        `외부 IP 조회 실패: ${err instanceof Error ? err.message : err}`,
      );
    } finally {
      try {
        client.destroy(() => {});
      } catch {
        // ignore
      }
    }
  }
}
