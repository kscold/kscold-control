import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '../../domain/repositories/user.repository.interface';
import { TerminalCommandStatusDto } from '../dto/terminal-limit.dto';

/**
 * Manage Terminal Limit Use Case
 * Business logic for managing terminal command limits
 */
@Injectable()
export class ManageTerminalLimitUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {}

  /**
   * Increment terminal command count
   * Returns whether the command is allowed and remaining count
   */
  async incrementCommandCount(
    userId: string,
  ): Promise<TerminalCommandStatusDto> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Unlimited if limit is -1
    if (user.terminalCommandLimit === -1) {
      await this.userRepository.incrementTerminalCommandCount(userId);
      return {
        allowed: true,
        remaining: -1,
        current: user.terminalCommandCount + 1,
        limit: -1,
      };
    }

    // Check if limit exceeded
    if (user.terminalCommandCount >= user.terminalCommandLimit) {
      return {
        allowed: false,
        remaining: 0,
        current: user.terminalCommandCount,
        limit: user.terminalCommandLimit,
      };
    }

    // Increment and return remaining
    await this.userRepository.incrementTerminalCommandCount(userId);
    const remaining =
      user.terminalCommandLimit - (user.terminalCommandCount + 1);

    return {
      allowed: true,
      remaining,
      current: user.terminalCommandCount + 1,
      limit: user.terminalCommandLimit,
    };
  }

  /**
   * Reset terminal command count to 0
   */
  async resetCommandCount(userId: string): Promise<{
    success: boolean;
    terminalCommandCount: number;
    terminalCommandLimit: number;
  }> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.userRepository.resetTerminalCommandCount(userId);

    return {
      success: true,
      terminalCommandCount: 0,
      terminalCommandLimit: user.terminalCommandLimit,
    };
  }

  /**
   * Update terminal command limit
   */
  async setCommandLimit(
    userId: string,
    limit: number,
  ): Promise<{ success: boolean; terminalCommandLimit: number }> {
    const user = await this.userRepository.updateTerminalCommandLimit(
      userId,
      limit,
    );
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      success: true,
      terminalCommandLimit: user.terminalCommandLimit,
    };
  }
}
