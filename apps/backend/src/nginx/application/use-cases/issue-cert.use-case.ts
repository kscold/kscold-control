import { Injectable } from '@nestjs/common';
import { CertService } from '../services/cert.service';

@Injectable()
export class IssueCertUseCase {
  constructor(private readonly certService: CertService) {}

  execute(domain: string, email: string, mode?: string) {
    return mode === 'standalone'
      ? this.certService.issueCertStandalone(domain, email)
      : this.certService.issueCert(domain, email);
  }
}
