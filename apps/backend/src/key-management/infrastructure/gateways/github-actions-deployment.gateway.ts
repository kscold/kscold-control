import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeploymentRun,
  IDeploymentGateway,
  TriggerDeploymentInput,
} from '../../domain/gateways/deployment.gateway.interface';
import { KeyManagementTargetService } from '../../application/services/key-management-target.service';
import { runProcess } from './process-runner';

interface GithubRunRecord {
  databaseId?: number;
  displayTitle?: string;
  status?: string;
  conclusion?: string;
  createdAt?: string;
  updatedAt?: string;
  url?: string;
}

@Injectable()
export class GithubActionsDeploymentGateway implements IDeploymentGateway {
  private readonly ghPath: string;

  constructor(
    config: ConfigService,
    private readonly targets: KeyManagementTargetService,
  ) {
    this.ghPath =
      config.get<string>('KEY_MANAGEMENT_GH_PATH') ?? '/opt/homebrew/bin/gh';
  }

  async trigger(input: TriggerDeploymentInput): Promise<void> {
    this.assertInput(input);
    const target = this.targets.get(input.targetId);
    try {
      await runProcess(this.ghPath, [
        'workflow',
        'run',
        target.workflow,
        '--repo',
        target.repository,
        '--ref',
        target.ref,
        '-f',
        `target=${input.targetId}`,
        '-f',
        `secret_version=${input.version}`,
        '-f',
        `request_id=${input.requestId}`,
      ]);
    } catch {
      throw new ServiceUnavailableException(
        'GitHub Actions 환경 변수 배포를 요청하지 못했습니다.',
      );
    }
  }

  async findByRequestId(requestId: string): Promise<DeploymentRun | null> {
    if (!/^[0-9a-f-]{36}$/i.test(requestId)) {
      return null;
    }
    const target = this.targets.list()[0];
    try {
      const { stdout } = await runProcess(this.ghPath, [
        'run',
        'list',
        '--repo',
        target.repository,
        '--workflow',
        target.workflow,
        '--limit',
        '50',
        '--json',
        'databaseId,displayTitle,status,conclusion,createdAt,updatedAt,url',
      ]);
      const runs = JSON.parse(stdout) as GithubRunRecord[];
      const run = runs.find((item) => item.displayTitle?.includes(requestId));
      if (!run) return null;

      return {
        requestId,
        runId: run.databaseId ? String(run.databaseId) : null,
        state: this.toState(run.status, run.conclusion),
        conclusion: run.conclusion ?? null,
        url: run.url ?? null,
        createdAt: run.createdAt ?? null,
        updatedAt: run.updatedAt ?? null,
      };
    } catch {
      throw new ServiceUnavailableException(
        'GitHub Actions 배포 상태를 조회하지 못했습니다.',
      );
    }
  }

  private toState(status?: string, conclusion?: string) {
    if (status === 'completed') {
      return conclusion === 'success'
        ? ('succeeded' as const)
        : ('failed' as const);
    }
    if (status === 'in_progress') return 'running' as const;
    return 'queued' as const;
  }

  private assertInput(input: TriggerDeploymentInput): void {
    if (
      !/^\d+$/.test(input.version) ||
      !/^[0-9a-f-]{36}$/i.test(input.requestId)
    ) {
      throw new ServiceUnavailableException(
        '배포 요청 식별자가 올바르지 않습니다.',
      );
    }
  }
}
