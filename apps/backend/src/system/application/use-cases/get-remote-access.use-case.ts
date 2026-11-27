import { Inject, Injectable } from '@nestjs/common';

import {
  REMOTE_ACCESS_REPOSITORY,
  type IRemoteAccessRepository,
} from '../../domain/repositories/remote-access.repository.interface';
import type { RemoteAccessPath } from '../../domain/types/remote-access.type';

/** 밖에서 들어오는 길(테일스케일·Orca 릴레이·SSH 차단기)이 살아 있는지 */
@Injectable()
export class GetRemoteAccessUseCase {
  constructor(
    @Inject(REMOTE_ACCESS_REPOSITORY)
    private readonly probe: IRemoteAccessRepository,
  ) {}

  execute(): Promise<RemoteAccessPath[]> {
    return this.probe.probe();
  }
}
