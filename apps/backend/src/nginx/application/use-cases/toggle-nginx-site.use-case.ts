import { Injectable } from '@nestjs/common';
import { NginxSiteService } from '../services/nginx-site.service';

@Injectable()
export class ToggleNginxSiteUseCase {
  constructor(private readonly nginxSiteService: NginxSiteService) {}

  execute(name: string) {
    return this.nginxSiteService.toggleSite(name);
  }
}
