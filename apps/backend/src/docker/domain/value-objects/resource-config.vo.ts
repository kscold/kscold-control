import { InvalidResourceConfigException } from '../../../common/exceptions';

/**
 * Resource Configuration Value Object
 * Immutable domain value for container resources
 */
export class ResourceConfig {
  constructor(
    public readonly cpus: number,
    public readonly memory: string,
  ) {
    this.validate();
  }

  /**
   * Validate resource configuration
   */
  private validate(): void {
    // Validate CPU
    if (this.cpus <= 0) {
      throw new InvalidResourceConfigException('CPU must be greater than 0');
    }
    if (this.cpus > 16) {
      throw new InvalidResourceConfigException('CPU cannot exceed 16 cores');
    }

    // Validate memory format
    if (!/^\d+[bkmg]$/i.test(this.memory)) {
      throw new InvalidResourceConfigException(
        'Memory must be in format: 1b, 512k, 4m, or 8g',
      );
    }

    // Validate memory size
    const bytes = this.toBytes();
    const minMemory = 128 * 1024 * 1024; // 128MB
    const maxMemory = 64 * 1024 * 1024 * 1024; // 64GB

    if (bytes < minMemory) {
      throw new InvalidResourceConfigException('Memory must be at least 128MB');
    }
    if (bytes > maxMemory) {
      throw new InvalidResourceConfigException('Memory cannot exceed 64GB');
    }
  }

  /**
   * Convert CPUs to Docker NanoCPUs format
   */
  toNanoCpus(): number {
    return this.cpus * 1e9;
  }

  /**
   * Convert memory string to bytes
   */
  toBytes(): number {
    const units: Record<string, number> = {
      b: 1,
      k: 1024,
      m: 1024 ** 2,
      g: 1024 ** 3,
    };

    const match = this.memory.match(/^(\d+)([bkmg])$/i);
    if (!match) {
      throw new InvalidResourceConfigException('Invalid memory format');
    }

    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();

    return value * units[unit];
  }

  /**
   * Format bytes to human-readable string
   */
  static formatBytes(bytes: number): string {
    if (bytes === 0) return '0';
    if (bytes < 1024) return `${bytes}b`;
    if (bytes < 1024 ** 2) return `${Math.floor(bytes / 1024)}k`;
    if (bytes < 1024 ** 3) return `${Math.floor(bytes / 1024 ** 2)}m`;
    return `${Math.floor(bytes / 1024 ** 3)}g`;
  }

  /**
   * Create from separate values
   */
  static create(cpus: number, memory: string): ResourceConfig {
    return new ResourceConfig(cpus, memory);
  }
}
