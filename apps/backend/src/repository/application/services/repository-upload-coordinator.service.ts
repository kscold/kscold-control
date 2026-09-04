import { Injectable } from '@nestjs/common';

/** 같은 프로젝트의 세션 생성·배치 기록·최종 반영을 한 번에 하나씩 실행한다. */
@Injectable()
export class RepositoryUploadCoordinator {
  private readonly tails = new Map<string, Promise<void>>();

  async runExclusive<T>(
    projectId: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const previous = this.tails.get(projectId) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = previous.catch(() => undefined).then(() => gate);
    this.tails.set(projectId, tail);

    await previous.catch(() => undefined);
    try {
      return await operation();
    } finally {
      release();
      if (this.tails.get(projectId) === tail) {
        this.tails.delete(projectId);
      }
    }
  }
}
