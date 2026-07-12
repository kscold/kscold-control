import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  type IUpnpGatewayRepository,
  UPNP_GATEWAY_REPOSITORY,
} from '../../../upnp/domain/interfaces/upnp-gateway.repository';

/**
 * Port Forwarding Service
 * Manages UPnP port forwarding for container external access
 */
@Injectable()
export class PortForwardingService {
  private readonly logger = new Logger(PortForwardingService.name);
  private externalIp: string | null = null;
  private readonly domain = 'kscold.iptime.org'; // Fixed domain

  constructor(
    @Inject(UPNP_GATEWAY_REPOSITORY)
    private readonly gateway: IUpnpGatewayRepository,
  ) {
    this.initializeExternalIp();
  }

  /**
   * Initialize external IP (runs once)
   */
  private initializeExternalIp() {
    void this.gateway
      .getExternalIp()
      .then((ip) => {
        this.externalIp = ip;
        this.logger.log(`External IP: ${this.externalIp}`);
      })
      .catch(() => {
        this.logger.warn(
          'Failed to get external IP via UPnP, using domain instead',
        );
        this.externalIp = this.domain;
      });
  }

  /**
   * Add port forwarding rule
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
        `Port forwarding added: ${externalPort} -> ${internalPort} (${description})`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to add port mapping ${externalPort} -> ${internalPort}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Remove port forwarding rule
   */
  async removePortMapping(externalPort: number): Promise<void> {
    try {
      await this.gateway.removeMapping(externalPort, 'TCP');
      this.logger.log(`Port forwarding removed: ${externalPort}`);
    } catch (error) {
      this.logger.error(
        `Failed to remove port mapping ${externalPort}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Add all port forwarding rules for a container
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
   * Remove all port forwarding rules for a container
   */
  async removePortForwardingRules(containerName: string): Promise<void> {
    // Note: Since we don't track which ports belong to which container,
    // this is a placeholder. In a real implementation, you'd need to
    // track mappings or query UPnP for existing rules.
    this.logger.log(`Removing port forwarding rules for ${containerName}`);
  }

  /**
   * Get external access information
   */
  getExternalAccess(ports: Record<string, number>): {
    ssh?: string;
    http?: string;
    domain: string;
  } {
    const result: any = { domain: this.domain };

    // SSH port (22)
    if (ports['22']) {
      result.ssh = `ssh root@${this.domain} -p ${ports['22']}`;
    }

    // HTTP port (80)
    if (ports['80']) {
      result.http = `http://${this.domain}:${ports['80']}`;
    }

    return result;
  }

  /**
   * Close UPnP connection
   */
  async close(): Promise<void> {
    this.logger.log('UPnP client closed');
  }
}
