import { Injectable } from '@nestjs/common';
import { CreateNginxSiteDto } from '../dto';
import { NginxSiteService } from '../services/nginx-site.service';

@Injectable()
export class UpdateNginxSiteUseCase {
  constructor(private readonly nginxSiteService: NginxSiteService) {}

  execute(name: string, dto: CreateNginxSiteDto) {
    return this.nginxSiteService.updateSite(name, dto);
  }
}
