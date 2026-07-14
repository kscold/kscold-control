import { Injectable } from '@nestjs/common';
import { ClaudeDiagnosticsService } from '../services/claude-diagnostics.service';

@Injectable()
export class GetClaudeDiagnosticsUseCase {
  constructor(private readonly diagnosticsService: ClaudeDiagnosticsService) {}

  execute(forceRefresh: boolean) {
    return this.diagnosticsService.getDiagnostics(forceRefresh);
  }
}
