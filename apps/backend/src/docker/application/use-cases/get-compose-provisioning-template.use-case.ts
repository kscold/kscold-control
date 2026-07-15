import { Injectable } from '@nestjs/common';
import { ComposeProvisioningTemplateResponseDto } from '../dto';
import { ComposeService } from '../services/compose.service';

/**
 * 새 Ubuntu 인스턴스 기본값을 안전하게 계산함.
 */
@Injectable()
export class GetComposeProvisioningTemplateUseCase {
  constructor(private readonly composeService: ComposeService) {}

  async execute(): Promise<ComposeProvisioningTemplateResponseDto> {
    const usedPorts = await this.composeService.getUsedHostPorts();
    const existingServices = new Set(this.composeService.listServices());

    return ComposeProvisioningTemplateResponseDto.from({
      name: this.generateName(existingServices),
      image: 'ubuntu:22.04',
      cpus: '2',
      memLimit: '4g',
      command: 'sleep infinity',
      ports: {
        '22': this.findAvailablePort(usedPorts, 2227),
        '8080': this.findAvailablePort(usedPorts, 8085),
      },
    });
  }

  private generateName(existingServices: Set<string>): string {
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:TZ.]/g, '')
      .slice(2, 14);

    let suffix = 0;
    let candidate = `ubuntu-${timestamp}`;

    while (existingServices.has(candidate)) {
      suffix += 1;
      candidate = `ubuntu-${timestamp}-${suffix}`;
    }

    return candidate;
  }

  private findAvailablePort(usedPorts: Set<number>, startPort: number): number {
    let port = startPort;

    while (usedPorts.has(port)) {
      port += 1;
    }

    usedPorts.add(port);
    return port;
  }
}
