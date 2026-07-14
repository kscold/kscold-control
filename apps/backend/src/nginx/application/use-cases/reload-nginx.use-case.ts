import { Injectable } from '@nestjs/common';
import { NginxSiteService } from '../services/nginx-site.service';

@Injectable()
export class ReloadNginxUseCase {
  constructor(private readonly nginxSiteService: NginxSiteService) {}

  execute() {
    return this.nginxSiteService.reloadNginx();
  }
}
