import { Injectable, Logger } from '@nestjs/common';
import * as http from 'http';
import * as dgram from 'dgram';

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

  private async discoverGatewayUrl(): Promise<string> {
    return new Promise((resolve, reject) => {
      const socket = dgram.createSocket('udp4');
      const msg = Buffer.from(
        'M-SEARCH * HTTP/1.1\r\n' +
          'HOST: 239.255.255.250:1900\r\n' +
          'MAN: "ssdp:discover"\r\n' +
          'MX: 3\r\n' +
          'ST: urn:schemas-upnp-org:service:WANIPConnection:1\r\n\r\n',
      );
      let found = false;
      socket.on('message', (buf) => {
        const str = buf.toString();
        const loc = str.match(/LOCATION: (.+)/i);
        if (loc && !found) {
          found = true;
          socket.close();
          resolve(loc[1].trim());
        }
      });
      socket.on('error', reject);
      socket.bind(() =>
        socket.send(msg, 0, msg.length, 1900, '239.255.255.250'),
      );
      setTimeout(() => {
        if (!found) {
          socket.close();
          reject(new Error('Gateway not found'));
        }
      }, 5000);
    });
  }

  private soapCall(
    host: string,
    port: number,
    path: string,
    action: string,
    body: string,
  ): Promise<string> {
    const soap = `<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><s:Body>${body}</s:Body></s:Envelope>`;
    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          host,
          port,
          path,
          method: 'POST',
          headers: {
            'Content-Type': 'text/xml; charset="utf-8"',
            SOAPAction: `"${action}"`,
            'Content-Length': Buffer.byteLength(soap),
          },
        },
        (res) => {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () => resolve(data));
        },
      );
      req.on('error', reject);
      req.setTimeout(5000, () => {
        req.destroy();
        reject(new Error('SOAP timeout'));
      });
      req.write(soap);
      req.end();
    });
  }

  async getMappings(): Promise<PortMapping[]> {
    try {
      const locationUrl = await this.discoverGatewayUrl();
      const url = new URL(locationUrl);
      const host = url.hostname;
      const port = parseInt(url.port || '80', 10);

      const results: PortMapping[] = [];
      for (let i = 0; i < 100; i++) {
        try {
          const xml = await this.soapCall(
            host,
            port,
            '/ctl/IPConn',
            'urn:schemas-upnp-org:service:WANIPConnection:1#GetGenericPortMappingEntry',
            `<u:GetGenericPortMappingEntry xmlns:u="urn:schemas-upnp-org:service:WANIPConnection:1"><NewPortMappingIndex>${i}</NewPortMappingIndex></u:GetGenericPortMappingEntry>`,
          );
          if (xml.includes('UPnPError') || xml.includes('Fault')) break;
          const get = (tag: string) => {
            const m = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
            return m ? m[1] : '';
          };
          results.push({
            publicPort: parseInt(get('NewExternalPort'), 10),
            privatePort: parseInt(get('NewInternalPort'), 10),
            protocol: (get('NewProtocol') || 'TCP').toUpperCase() as
              | 'TCP'
              | 'UDP',
            description: get('NewPortMappingDescription'),
            enabled: get('NewEnabled') !== '0',
            ttl: parseInt(get('NewLeaseDuration') || '0', 10),
            privateHost: get('NewInternalClient'),
            local: false,
          });
        } catch {
          break;
        }
      }
      return results;
    } catch (err) {
      this.logger.warn(
        'getMappings failed, returning empty',
        err instanceof Error ? err.message : err,
      );
      return [];
    }
  }

  private getLocalIp(): string {
    const { networkInterfaces } = require('os');
    const nets = networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        if (net.family === 'IPv4' && !net.internal) return net.address;
      }
    }
    return '192.168.0.1';
  }

  async addMapping(dto: CreateMappingDto): Promise<{ success: boolean }> {
    try {
      const locationUrl = await this.discoverGatewayUrl();
      const url = new URL(locationUrl);
      const host = url.hostname;
      const port = parseInt(url.port || '80', 10);
      const protocol = (dto.protocol || 'TCP').toUpperCase();
      const internalClient = this.getLocalIp();

      const xml = await this.soapCall(
        host,
        port,
        '/ctl/IPConn',
        'urn:schemas-upnp-org:service:WANIPConnection:1#AddPortMapping',
        `<u:AddPortMapping xmlns:u="urn:schemas-upnp-org:service:WANIPConnection:1">` +
          `<NewRemoteHost></NewRemoteHost>` +
          `<NewExternalPort>${dto.publicPort}</NewExternalPort>` +
          `<NewProtocol>${protocol}</NewProtocol>` +
          `<NewInternalPort>${dto.privatePort}</NewInternalPort>` +
          `<NewInternalClient>${internalClient}</NewInternalClient>` +
          `<NewEnabled>1</NewEnabled>` +
          `<NewPortMappingDescription>${dto.description || 'kscold-control'}</NewPortMappingDescription>` +
          `<NewLeaseDuration>7200</NewLeaseDuration>` +
          `</u:AddPortMapping>`,
      );

      if (xml.includes('UPnPError') || xml.includes('Fault')) {
        const code = xml.match(/<errorCode>(\d+)<\/errorCode>/)?.[1];
        throw new Error(`UPnP 오류 코드: ${code}`);
      }

      this.logger.log(
        `Port mapping added: ${dto.publicPort} -> ${dto.privatePort} (${protocol}) for ${internalClient}`,
      );
      return { success: true };
    } catch (err) {
      this.logger.error('Failed to add UPnP mapping', err);
      throw new Error(
        `포트 매핑 추가 실패: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  async removeMapping(
    publicPort: number,
    protocol?: string,
  ): Promise<{ success: boolean }> {
    try {
      const locationUrl = await this.discoverGatewayUrl();
      const url = new URL(locationUrl);
      const host = url.hostname;
      const port = parseInt(url.port || '80', 10);
      const proto = (protocol || 'TCP').toUpperCase();

      const xml = await this.soapCall(
        host,
        port,
        '/ctl/IPConn',
        'urn:schemas-upnp-org:service:WANIPConnection:1#DeletePortMapping',
        `<u:DeletePortMapping xmlns:u="urn:schemas-upnp-org:service:WANIPConnection:1">` +
          `<NewRemoteHost></NewRemoteHost>` +
          `<NewExternalPort>${publicPort}</NewExternalPort>` +
          `<NewProtocol>${proto}</NewProtocol>` +
          `</u:DeletePortMapping>`,
      );

      if (xml.includes('UPnPError') || xml.includes('Fault')) {
        const code = xml.match(/<errorCode>(\d+)<\/errorCode>/)?.[1];
        throw new Error(`UPnP 오류 코드: ${code}`);
      }

      this.logger.log(`Port mapping removed: ${publicPort} (${proto})`);
      return { success: true };
    } catch (err) {
      this.logger.error('Failed to remove UPnP mapping', err);
      throw new Error(
        `포트 매핑 삭제 실패: ${err instanceof Error ? err.message : err}`,
      );
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
