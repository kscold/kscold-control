import { Injectable } from '@nestjs/common';
import { ComposeService } from '../services/compose.service';

/** Compose 서비스 목록과 현재 compose 설정 조회 */
@Injectable()
export class ListComposeServicesUseCase {
  constructor(private readonly composeService: ComposeService) {}

  execute() {
    return {
      services: this.composeService.listServices(),
      compose: this.composeService.readCompose(),
    };
  }
}
