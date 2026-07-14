import { Injectable } from '@nestjs/common';
import { TerminalLimitService } from '../services/terminal-limit.service';

/** 터미널 명령어 사용 제한 확인 및 카운트 증가 */
@Injectable()
export class CheckTerminalCommandLimitUseCase {
  constructor(private readonly terminalLimit: TerminalLimitService) {}

  execute(userId: string): Promise<{
    allowed: boolean;
    remaining: number;
    count: number;
    limit: number;
  }> {
    return this.terminalLimit.checkAndIncrementCommand(userId);
  }
}
