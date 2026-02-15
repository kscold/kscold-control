import { Injectable, Logger } from '@nestjs/common';
import NatAPI = require('nat-api');

/**
 * Port Forwarding Service
 * Manages UPnP port forwarding for container external access
 */
@Injectable()
export class PortForwardingService {
  private readonly logger = new Logger(PortForwardingService.name);
  private client: any;
  private externalIp: string | null = null;
  private readonly domain = 'kscold.iptime.org'; // Fixed domain

  constructor() {
    this.client = new NatAPI({ ttl: 0 }); // 0 = permanent
    this.initializeExternalIp();
  }

  /**
   * Initialize external IP (runs once)
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
   * Add port forwarding rule
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
          // Continue even if UPnP fails
          resolve();
        },
      );
    });
  }

  /**
   * Remove port forwarding rule
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
    return new Promise((resolve) => {
      this.client.destroy();
      this.logger.log('UPnP client closed');
      resolve();
    });
  }
}
