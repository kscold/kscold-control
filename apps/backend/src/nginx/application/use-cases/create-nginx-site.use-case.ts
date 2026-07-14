import { Injectable } from '@nestjs/common';
import { NginxSiteService } from '../services/nginx-site.service';
import { CreateNginxSiteRequestDto } from '../../presentation/dto/create-nginx-site.request.dto';

@Injectable()
export class CreateNginxSiteUseCase {
  constructor(private readonly nginxSiteService: NginxSiteService) {}

  execute(dto: CreateNginxSiteRequestDto) {
    return this.nginxSiteService.createSite(dto);
  }
}
