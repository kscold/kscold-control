import { Injectable, Inject } from '@nestjs/common';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '../../../rbac/domain/repositories/user.repository.interface';

/**
 * Terminal Limit Service
 * Application service for managing terminal command limits
 */
@Injectable()
export class TerminalLimitService {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {}

  /**
   * Check if user can execute command and increment count
   * Returns { allowed: boolean, remaining: number, count: number, limit: number }
   */
  async checkAndIncrementCommand(userId: string): Promise<{
    allowed: boolean;
    remaining: number;
    count: number;
    limit: number;
  }> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Unlimited if limit is -1
    if (user.terminalCommandLimit === -1) {
      await this.userRepository.incrementTerminalCommandCount(userId);
      return {
        allowed: true,
        remaining: -1,
        count: user.terminalCommandCount + 1,
        limit: -1,
      };
    }

    // Check if limit exceeded
    if (user.terminalCommandCount >= user.terminalCommandLimit) {
      return {
        allowed: false,
        remaining: 0,
        count: user.terminalCommandCount,
        limit: user.terminalCommandLimit,
      };
    }

    // Increment count
    await this.userRepository.incrementTerminalCommandCount(userId);
    const newCount = user.terminalCommandCount + 1;
    const remaining = user.terminalCommandLimit - newCount;

    return {
      allowed: true,
      remaining,
      count: newCount,
      limit: user.terminalCommandLimit,
    };
  }

  /**
   * Get current command usage for user
   */
  async getCommandUsage(userId: string): Promise<{
    count: number;
    limit: number;
    remaining: number;
  }> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const remaining =
      user.terminalCommandLimit === -1
        ? -1
        : user.terminalCommandLimit - user.terminalCommandCount;

    return {
      count: user.terminalCommandCount,
      limit: user.terminalCommandLimit,
      remaining,
    };
  }
}
