import { Injectable, Logger } from '@nestjs/common';
import { isIP } from 'net';
import { searchSsdp } from '../ssdp-discovery';
import { requestGateway } from '../gateway-http';
import { UpnpQueryError } from '../../domain/errors/upnp-query.error';

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
  private discovery: Promise<GatewayInfo> | null = null;

  // ── SSDP 게이트웨이 탐색 ─────────────────────────────────

  private async discoverGatewayUrl(): Promise<string> {
    const searchTargets = [
      'urn:schemas-upnp-org:service:WANIPConnection:1',
      'urn:schemas-upnp-org:device:InternetGatewayDevice:1',
      'upnp:rootdevice',
    ];

    for (const st of searchTargets) {
      try {
        const loc = await searchSsdp(st);
        if (loc) return loc;
      } catch {
        // 현재 탐색 대상 실패 시 다음 대상으로 계속 시도함.
      }
    }
    throw new UpnpQueryError('UPNP_UNAVAILABLE');
  }

  // ── HTTP·SOAP 통신 ───────────────────────────────────────

  private httpGet(host: string, port: number, path: string): Promise<string> {
    return requestGateway({ host, port, path, method: 'GET' });
  }

  private soapCall(
    host: string,
    port: number,
    path: string,
    action: string,
    body: string,
  ): Promise<string> {
    const soap = `<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><s:Body>${body}</s:Body></s:Envelope>`;
    return requestGateway(
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
      soap,
    );
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

    if (!this.discovery) {
      this.discovery = this.discoverUncachedGateway().finally(() => {
        this.discovery = null;
      });
    }
    return this.discovery;
  }

  private async discoverUncachedGateway(): Promise<GatewayInfo> {
    const locationUrl = await this.discoverGatewayUrl();
    const url = new URL(locationUrl);
    const host = url.hostname;
    const port = parseInt(url.port || '80', 10);

    try {
      const descXml = await this.httpGet(host, port, url.pathname);

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
    } catch {
      this.logger.warn(
        'UPnP description unavailable; checking compatible endpoints',
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
        if (
          !testXml.includes('Fault') &&
          /<NewExternalIPAddress>[^<]+<\/NewExternalIPAddress>/i.test(testXml)
        ) {
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

    throw new UpnpQueryError('UPNP_UNAVAILABLE');
  }

  async getMappings(): Promise<PortMapping[]> {
    const deadline = Date.now() + 25_000;
    const gw = await this.discoverGateway();
    const results: PortMapping[] = [];

    for (let i = 0; i <= 100; i++) {
      try {
        if (Date.now() > deadline)
          throw new UpnpQueryError('UPNP_QUERY_FAILED');
        const xml = await this.soapCall(
          gw.host,
          gw.port,
          gw.controlUrl,
          `${gw.serviceType}#GetGenericPortMappingEntry`,
          `<u:GetGenericPortMappingEntry xmlns:u="${gw.serviceType}"><NewPortMappingIndex>${i}</NewPortMappingIndex></u:GetGenericPortMappingEntry>`,
        );
        if (xml.includes('UPnPError') || xml.includes('Fault')) {
          // 713만 정상적인 목록 끝임. 통신 오류·미지원은 빈 목록으로 위장하지 않음.
          if (/<errorCode>\s*713\s*<\/errorCode>/i.test(xml)) return results;
          throw new UpnpQueryError('UPNP_QUERY_FAILED');
        }
        const get = (tag: string) => {
          const m = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
          return m ? m[1] : '';
        };
        const pubPort = Number(get('NewExternalPort'));
        const privatePort = Number(get('NewInternalPort'));
        const privateHost = get('NewInternalClient').trim();
        const protocol = get('NewProtocol').trim().toUpperCase();
        if (
          !Number.isInteger(pubPort) ||
          pubPort < 1 ||
          pubPort > 65535 ||
          !Number.isInteger(privatePort) ||
          privatePort < 1 ||
          privatePort > 65535 ||
          !isIP(privateHost) ||
          !['TCP', 'UDP'].includes(protocol) ||
          i === 100
        )
          throw new UpnpQueryError('UPNP_QUERY_FAILED');
        results.push({
          publicPort: pubPort,
          privatePort,
          protocol: protocol as 'TCP' | 'UDP',
          description: get('NewPortMappingDescription'),
          enabled: get('NewEnabled') !== '0',
          ttl: parseInt(get('NewLeaseDuration') || '0', 10),
          privateHost,
          local: false,
        });
      } catch {
        throw new UpnpQueryError('UPNP_QUERY_FAILED');
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
    if (!ip || !isIP(ip.trim())) throw new UpnpQueryError('UPNP_QUERY_FAILED');
    return ip.trim();
  }
}
