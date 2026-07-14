import { Injectable } from '@nestjs/common';
import { NginxSiteService } from '../services/nginx-site.service';
import { CreateNginxSiteRequestDto } from '../../presentation/dto/create-nginx-site.request.dto';

@Injectable()
export class UpdateNginxSiteUseCase {
  constructor(private readonly nginxSiteService: NginxSiteService) {}

  execute(name: string, dto: CreateNginxSiteRequestDto) {
    return this.nginxSiteService.updateSite(name, dto);
  }
}
