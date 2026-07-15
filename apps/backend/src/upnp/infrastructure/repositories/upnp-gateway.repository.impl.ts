import { Injectable, Logger } from '@nestjs/common';
import * as http from 'http';
import * as dgram from 'dgram';

import type { IUpnpGatewayRepository } from '../../domain/repositories/upnp-gateway.repository';
import type {
  PortMapping,
  PortMappingDraft,
  GatewayInfo,
} from '../../domain/types/port-mapping.type';

@Injectable()
export class UpnpGatewayRepositoryImpl implements IUpnpGatewayRepository {
  private readonly logger = new Logger(UpnpGatewayRepositoryImpl.name);
  private gatewayCache: GatewayInfo | null = null;
  private gatewayCacheTime = 0;

  // ── SSDP 게이트웨이 탐색 ─────────────────────────────────

  private async discoverGatewayUrl(): Promise<string> {
    const searchTargets = [
      'urn:schemas-upnp-org:service:WANIPConnection:1',
      'urn:schemas-upnp-org:device:InternetGatewayDevice:1',
      'upnp:rootdevice',
    ];

    for (const st of searchTargets) {
      try {
        const loc = await this.ssdpSearch(st);
        if (loc) return loc;
      } catch {
        // 현재 탐색 대상 실패 시 다음 대상으로 계속 시도함.
      }
    }
    throw new Error('Gateway not found via SSDP');
  }

  private ssdpSearch(st: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const socket = dgram.createSocket('udp4');
      const msg = Buffer.from(
        'M-SEARCH * HTTP/1.1\r\n' +
          'HOST: 239.255.255.250:1900\r\n' +
          'MAN: "ssdp:discover"\r\n' +
          'MX: 3\r\n' +
          `ST: ${st}\r\n\r\n`,
      );
      let found = false;
      socket.on('message', (buf) => {
        const str = buf.toString();
        const loc = str.match(/LOCATION:\s*(.+)/i);
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
          try {
            socket.close();
          } catch {
            /* 소켓 종료 중 오류는 무시함. */
          }
          reject(new Error(`SSDP timeout for ${st}`));
        }
      }, 4000);
    });
  }

  // ── HTTP·SOAP 통신 ───────────────────────────────────────

  private httpGet(host: string, port: number, path: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const req = http.get({ host, port, path, timeout: 5000 }, (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve(data));
      });
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('HTTP timeout'));
      });
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

  // ── 네트워크 보조 함수 ────────────────────────────────────

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

  // ── UPnP 게이트웨이 포트 구현 ─────────────────────────────

  /**
   * UPnP 게이트웨이를 탐색하고 설명 XML에서 실제 controlURL을 추출함.
   * 반복 SSDP 브로드캐스트를 줄이기 위해 결과를 2분간 캐시함.
   */
  private async discoverGateway(): Promise<GatewayInfo> {
    if (this.gatewayCache && Date.now() - this.gatewayCacheTime < 120000) {
      return this.gatewayCache;
    }

    const locationUrl = await this.discoverGatewayUrl();
    const url = new URL(locationUrl);
    const host = url.hostname;
    const port = parseInt(url.port || '80', 10);

    try {
      const descXml = await this.httpGet(host, port, url.pathname);
      this.logger.debug(
        `Description XML from ${locationUrl}:\n${descXml.slice(0, 500)}`,
      );

      // WANIPConnection 또는 WANPPPConnection 서비스 블록 우선 탐색함.
      const serviceBlockRegex = /<service>([\s\S]*?)<\/service>/gi;
      let match: RegExpExecArray | null;
      while ((match = serviceBlockRegex.exec(descXml)) !== null) {
        const block = match[1];
        const stMatch = block.match(/<serviceType>([^<]+)<\/serviceType>/i);
        const serviceType = stMatch?.[1]?.trim() || '';

        if (
          serviceType.toLowerCase().includes('wanipconnection') ||
          serviceType.toLowerCase().includes('wanpppconnection')
        ) {
          const ctrlMatch = block.match(/<controlURL>([^<]+)<\/controlURL>/i);
          if (ctrlMatch) {
            let controlUrl = ctrlMatch[1].trim();
            if (!controlUrl.startsWith('/')) controlUrl = '/' + controlUrl;

            this.gatewayCache = { host, port, controlUrl, serviceType };
            this.gatewayCacheTime = Date.now();
            this.logger.log(
              `UPnP gateway discovered: ${host}:${port}${controlUrl} [${serviceType}]`,
            );
            return this.gatewayCache;
          }
        }
      }

      this.logger.warn(
        'No WANIPConnection service found in description XML, trying fallback paths',
      );
    } catch (err) {
      this.logger.warn(
        'Failed to fetch/parse gateway description XML',
        err instanceof Error ? err.message : err,
      );
    }

    // 설명 XML에 서비스 정보가 없으면 일반 라우터 경로를 순서대로 시도함.
    const fallbackPaths = [
      '/UpnP/Control/WANIPConn1',
      '/ctl/IPConn',
      '/upnp/control/WANIPConnection',
      '/WANIPConn',
    ];
    for (const controlUrl of fallbackPaths) {
      try {
        const testXml = await this.soapCall(
          host,
          port,
          controlUrl,
          'urn:schemas-upnp-org:service:WANIPConnection:1#GetExternalIPAddress',
          '<u:GetExternalIPAddress xmlns:u="urn:schemas-upnp-org:service:WANIPConnection:1"></u:GetExternalIPAddress>',
        );
        if (!testXml.includes('Fault') && !testXml.includes('404')) {
          const info: GatewayInfo = {
            host,
            port,
            controlUrl,
            serviceType: 'urn:schemas-upnp-org:service:WANIPConnection:1',
          };
          this.gatewayCache = info;
          this.gatewayCacheTime = Date.now();
          this.logger.log(
            `UPnP gateway fallback: ${host}:${port}${controlUrl}`,
          );
          return info;
        }
      } catch {
        /* 현재 후보 실패 시 다음 후보를 시도함. */
      }
    }

    // 모든 후보 실패 시 기존 기본 경로를 마지막 대체값으로 사용함.
    const info: GatewayInfo = {
      host,
      port,
      controlUrl: '/UpnP/Control/WANIPConn1',
      serviceType: 'urn:schemas-upnp-org:service:WANIPConnection:1',
    };
    this.gatewayCache = info;
    this.gatewayCacheTime = Date.now();
    return info;
  }

  async getMappings(): Promise<PortMapping[]> {
    const gw = await this.discoverGateway();
    const results: PortMapping[] = [];

    for (let i = 0; i < 100; i++) {
      try {
        const xml = await this.soapCall(
          gw.host,
          gw.port,
          gw.controlUrl,
          `${gw.serviceType}#GetGenericPortMappingEntry`,
          `<u:GetGenericPortMappingEntry xmlns:u="${gw.serviceType}"><NewPortMappingIndex>${i}</NewPortMappingIndex></u:GetGenericPortMappingEntry>`,
        );
        if (xml.includes('UPnPError') || xml.includes('Fault')) break;
        const get = (tag: string) => {
          const m = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
          return m ? m[1] : '';
        };
        const pubPort = parseInt(get('NewExternalPort'), 10);
        if (!pubPort) break;
        results.push({
          publicPort: pubPort,
          privatePort: parseInt(get('NewInternalPort'), 10),
          protocol: (get('NewProtocol') || 'TCP').toUpperCase() as
            'TCP' | 'UDP',
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
  }

  async addMapping(draft: PortMappingDraft): Promise<void> {
    const gw = await this.discoverGateway();
    const protocol = (draft.protocol || 'TCP').toUpperCase();
    const internalClient = this.getLocalIp();

    const xml = await this.soapCall(
      gw.host,
      gw.port,
      gw.controlUrl,
      `${gw.serviceType}#AddPortMapping`,
      `<u:AddPortMapping xmlns:u="${gw.serviceType}">` +
        `<NewRemoteHost></NewRemoteHost>` +
        `<NewExternalPort>${draft.publicPort}</NewExternalPort>` +
        `<NewProtocol>${protocol}</NewProtocol>` +
        `<NewInternalPort>${draft.privatePort}</NewInternalPort>` +
        `<NewInternalClient>${internalClient}</NewInternalClient>` +
        `<NewEnabled>1</NewEnabled>` +
        `<NewPortMappingDescription>${draft.description || 'kscold-control'}</NewPortMappingDescription>` +
        `<NewLeaseDuration>0</NewLeaseDuration>` +
        `</u:AddPortMapping>`,
    );

    if (xml.includes('UPnPError') || xml.includes('Fault')) {
      const code = xml.match(/<errorCode>(\d+)<\/errorCode>/)?.[1];
      throw new Error(`UPnP 오류 코드: ${code}`);
    }

    this.logger.log(
      `Port mapping added: ${draft.publicPort} -> ${draft.privatePort} (${protocol}) for ${internalClient}`,
    );
  }

  async removeMapping(publicPort: number, protocol: string): Promise<void> {
    const gw = await this.discoverGateway();
    const proto = protocol.toUpperCase();

    const xml = await this.soapCall(
      gw.host,
      gw.port,
      gw.controlUrl,
      `${gw.serviceType}#DeletePortMapping`,
      `<u:DeletePortMapping xmlns:u="${gw.serviceType}">` +
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
  }

  async getExternalIp(): Promise<string> {
    const gw = await this.discoverGateway();
    const xml = await this.soapCall(
      gw.host,
      gw.port,
      gw.controlUrl,
      `${gw.serviceType}#GetExternalIPAddress`,
      `<u:GetExternalIPAddress xmlns:u="${gw.serviceType}"></u:GetExternalIPAddress>`,
    );

    if (xml.includes('UPnPError') || xml.includes('Fault')) {
      throw new Error('UPnP 외부 IP 조회 실패');
    }

    const ip = xml.match(
      /<NewExternalIPAddress>([^<]+)<\/NewExternalIPAddress>/i,
    )?.[1];
    if (!ip) throw new Error('UPnP 외부 IP 응답이 없습니다');
    return ip.trim();
  }
}
