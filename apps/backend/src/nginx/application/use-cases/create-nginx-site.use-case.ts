import { Injectable } from '@nestjs/common';
import { NginxSiteService } from '../services/nginx-site.service';
import type { CreateNginxSiteInput } from '../dto/create-nginx-site.input';

@Injectable()
export class CreateNginxSiteUseCase {
  constructor(private readonly nginxSiteService: NginxSiteService) {}

  execute(dto: CreateNginxSiteInput) {
    return this.nginxSiteService.createSite(dto);
  }
}
