import { InvalidResourceConfigException } from '../../../common/exceptions';

/**
 * 컨테이너 자원 설정 값 객체임.
 * CPU와 메모리 제한을 불변 값으로 묶고, Docker 호출 전에 범위 검증함.
 */
export class ResourceConfig {
  constructor(
    public readonly cpus: number,
    public readonly memory: string,
  ) {
    this.validate();
  }

  /**
   * 자원 설정의 범위와 단위 형식 검증함.
   */
  private validate(): void {
    // CPU 코어 수는 0보다 크고 현재 서비스가 지원하는 최대치 이하여야 함.
    if (this.cpus <= 0) {
      throw new InvalidResourceConfigException('CPU must be greater than 0');
    }
    if (this.cpus > 16) {
      throw new InvalidResourceConfigException('CPU cannot exceed 16 cores');
    }

    // 메모리는 숫자와 바이트 단위 한 글자로만 받음.
    if (!/^\d+[bkmg]$/i.test(this.memory)) {
      throw new InvalidResourceConfigException(
        'Memory must be in format: 1b, 512k, 4m, or 8g',
      );
    }

    // 형식이 맞아도 실제 바이트 수가 허용 범위 안인지 확인함.
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
   * CPU 코어 수를 Docker NanoCPU 단위로 변환함.
   */
  toNanoCpus(): number {
    return this.cpus * 1e9;
  }

  /**
   * 메모리 문자열을 바이트 단위로 변환함.
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
   * 바이트 수를 관리 모델에서 쓰는 사람이 읽기 쉬운 단위로 변환함.
   */
  static formatBytes(bytes: number): string {
    if (bytes === 0) return '0';
    if (bytes < 1024) return `${bytes}b`;
    if (bytes < 1024 ** 2) return `${Math.floor(bytes / 1024)}k`;
    if (bytes < 1024 ** 3) return `${Math.floor(bytes / 1024 ** 2)}m`;
    return `${Math.floor(bytes / 1024 ** 3)}g`;
  }

  /**
   * 분리된 CPU·메모리 값으로 검증된 값 객체 만듦.
   */
  static create(cpus: number, memory: string): ResourceConfig {
    return new ResourceConfig(cpus, memory);
  }
}
