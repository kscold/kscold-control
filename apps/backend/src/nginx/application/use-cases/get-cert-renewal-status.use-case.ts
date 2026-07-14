import { Injectable } from '@nestjs/common';
import { CertService } from '../services/cert.service';

@Injectable()
export class GetCertRenewalStatusUseCase {
  constructor(private readonly certService: CertService) {}

  execute() {
    return this.certService.getRenewalStatus();
  }
}
