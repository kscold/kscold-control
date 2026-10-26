import { Injectable, Logger } from '@nestjs/common';
import { sanitizeFrontendDiagnostic } from '../../../common/utils/frontend-diagnostic.util';

/** 프론트엔드 에러 기록 (POST /logs/frontend-error) */
@Injectable()
export class LogFrontendErrorUseCase {
  private readonly logger = new Logger(LogFrontendErrorUseCase.name);
  private readonly windows = new Map<
    string,
    { start: number; count: number }
  >();

  execute(info: unknown, userId: string): boolean {
    const now = Date.now();
    for (const [id, window] of this.windows) {
      if (now - window.start >= 60_000) this.windows.delete(id);
    }
    let window = this.windows.get(userId);
    if (!window) {
      if (this.windows.size >= 1000) return false;
      window = { start: now, count: 0 };
      this.windows.set(userId, window);
    }
    if (window.count >= 20) return false;
    window.count += 1;
    this.logger.error(
      `[FrontendError] ${JSON.stringify(sanitizeFrontendDiagnostic(info))}`,
    );
    return true;
  }
}
