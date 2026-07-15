import { Injectable } from '@nestjs/common';
import { CreateNginxSiteDto } from '../dto';
import { NginxSiteService } from '../services/nginx-site.service';

@Injectable()
export class CreateNginxSiteUseCase {
  constructor(private readonly nginxSiteService: NginxSiteService) {}

  execute(dto: CreateNginxSiteDto) {
    return this.nginxSiteService.createSite(dto);
  }
}
