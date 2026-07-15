import { Injectable } from '@nestjs/common';
import { NginxSiteService } from '../services/nginx-site.service';
import type { CreateNginxSiteInput } from '../dto/create-nginx-site.input';

@Injectable()
export class UpdateNginxSiteUseCase {
  constructor(private readonly nginxSiteService: NginxSiteService) {}

  execute(name: string, dto: CreateNginxSiteInput) {
    return this.nginxSiteService.updateSite(name, dto);
  }
}
