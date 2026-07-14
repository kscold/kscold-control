import { Injectable } from '@nestjs/common';
import { NginxSiteService } from '../services/nginx-site.service';

@Injectable()
export class DeleteNginxSiteUseCase {
  constructor(private readonly nginxSiteService: NginxSiteService) {}

  execute(name: string) {
    return this.nginxSiteService.deleteSite(name);
  }
}
