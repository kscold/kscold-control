import { Injectable, Logger } from '@nestjs/common';

/** 프론트엔드 에러 기록 (POST /logs/frontend-error) */
@Injectable()
export class LogFrontendErrorUseCase {
  private readonly logger = new Logger(LogFrontendErrorUseCase.name);

  execute(info: {
    message: string;
    stack?: string;
    componentStack?: string;
    url?: string;
  }): void {
    this.logger.error(
      `[FrontendError] ${info.message} url=${info.url ?? '-'}`,
      info.stack,
    );
    if (info.componentStack) {
      this.logger.debug(
        `[FrontendError] componentStack: ${info.componentStack}`,
      );
    }
  }
}
