import { Injectable } from '@nestjs/common';
import { CertService } from '../services/cert.service';

@Injectable()
export class RenewCertsUseCase {
  constructor(private readonly certService: CertService) {}

  execute() {
    return this.certService.runRenewal('manual');
  }
}
