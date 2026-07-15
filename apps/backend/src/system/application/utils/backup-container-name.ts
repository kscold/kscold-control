import { BadRequestException } from '@nestjs/common';

export function assertValidBackupContainerName(containerName: string): void {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(containerName)) {
    throw new BadRequestException('잘못된 컨테이너 이름입니다.');
  }
}
