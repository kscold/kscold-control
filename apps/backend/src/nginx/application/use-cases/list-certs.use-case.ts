import { Injectable } from '@nestjs/common';
import { CertService } from '../services/cert.service';

@Injectable()
export class ListCertsUseCase {
  constructor(private readonly certService: CertService) {}

  execute() {
    return this.certService.listCerts();
  }
}
