import { BadRequestException } from '@nestjs/common';
import { isSafeRepositoryPath } from '../../domain/policies/repository-path.policy';

export function assertSafeRepositoryPath(relativePath: string): void {
  if (!isSafeRepositoryPath(relativePath)) {
    throw new BadRequestException(`안전하지 않은 경로: ${relativePath}`);
  }
}
