import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  DeploymentRun,
  DeploymentState,
  IDeploymentGateway,
  TriggerDeploymentInput,
} from '../../domain/gateways/deployment.gateway.interface';
import type {
  KeyManagementTarget,
  SshBlueGreenDeploymentConfig,
} from '../../domain/types/key-management-target.type';
import { KeyManagementTargetService } from '../../application/services/key-management-target.service';
import {
  shellQuote,
  SshTargetCommandService,
} from './ssh-target-command.service';

const REQUEST_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VERSION = /^(?:\d+|[a-f0-9]{64})$/;
const DEPLOYMENT_TIMEOUT_SECONDS = 15 * 60;

@Injectable()
export class SshBlueGreenDeploymentGateway implements IDeploymentGateway {
  constructor(
    private readonly targets: KeyManagementTargetService,
    private readonly ssh: SshTargetCommandService,
  ) {}

  async trigger(input: TriggerDeploymentInput): Promise<void> {
    this.assertInput(input);
    const target = await this.getTarget(input.targetId);
    const config = target.deploymentConfig as SshBlueGreenDeploymentConfig;
    const statePath = `${config.statusDirectory}/${input.requestId}.state`;
    const logPath = `${config.statusDirectory}/${input.requestId}.log`;
    const lockPath = `${config.statusDirectory}/deployment.lock`;
    const releaseLabel = `control-env-${input.version.slice(0, 12)}`;
    const runner = [
      'state="$1"',
      'workdir="$2"',
      'script="$3"',
      'release="$4"',
      'lock="$5"',
      'started=$(date +%s)',
      'temporary="${state}.tmp.$$"',
      'exec 8>"$lock"',
      'if ! flock -n 8; then printf "failed|%s|%s\\n" "$started" "$(date +%s)" >"$temporary"; mv -f -- "$temporary" "$state"; exit 0; fi',
      'printf "running|%s|\\n" "$started" >"$temporary"',
      'mv -f -- "$temporary" "$state"',
      'if cd "$workdir" && bash "$script" "$release"; then result=succeeded; else result=failed; fi',
      'completed=$(date +%s)',
      'printf "%s|%s|%s\\n" "$result" "$started" "$completed" >"$temporary"',
      'mv -f -- "$temporary" "$state"',
    ].join('; ');
    const command = [
      'set -eu',
      'umask 077',
      `directory=${shellQuote(config.statusDirectory)}`,
      `state=${shellQuote(statePath)}`,
      `log=${shellQuote(logPath)}`,
      'mkdir -p -- "$directory"',
      'chmod 700 "$directory"',
      '[ ! -e "$state" ]',
      'started=$(date +%s)',
      'printf "queued|%s|\\n" "$started" >"$state"',
      `nohup sh -c ${shellQuote(runner)} sh "$state" ${shellQuote(config.workingDirectory)} ${shellQuote(config.script)} ${shellQuote(releaseLabel)} ${shellQuote(lockPath)} >"$log" 2>&1 </dev/null &`,
      'printf "%s\\n" "$!"',
    ].join('\n');

    const output = await this.ssh.execute(target, command, {
      timeoutMs: 15_000,
      maxOutputBytes: 64,
    });
    if (!/^\d+\s*$/.test(output)) {
      throw new ServiceUnavailableException(
        'SSH blue/green 배포 작업을 시작하지 못했습니다.',
      );
    }
  }

  async findByRequestId(
    targetId: string,
    requestId: string,
  ): Promise<DeploymentRun | null> {
    if (!REQUEST_ID.test(requestId)) return null;
    const target = await this.getTarget(targetId);
    const config = target.deploymentConfig as SshBlueGreenDeploymentConfig;
    const statePath = `${config.statusDirectory}/${requestId}.state`;
    const command = [
      'set -eu',
      `state=${shellQuote(statePath)}`,
      'if [ -f "$state" ]; then cat -- "$state"; else printf "missing\\n"; fi',
    ].join('; ');
    const output = (
      await this.ssh.execute(target, command, {
        timeoutMs: 15_000,
        maxOutputBytes: 256,
      })
    ).trim();
    if (output === 'missing') return null;

    const [rawState, startedRaw, completedRaw] = output.split('|');
    if (
      !['queued', 'running', 'succeeded', 'failed'].includes(rawState) ||
      !/^\d{1,12}$/.test(startedRaw) ||
      (completedRaw && !/^\d{1,12}$/.test(completedRaw))
    ) {
      throw new ServiceUnavailableException(
        'SSH blue/green 배포 상태가 올바르지 않습니다.',
      );
    }

    const started = Number(startedRaw);
    const stale =
      ['queued', 'running'].includes(rawState) &&
      Date.now() / 1_000 - started > DEPLOYMENT_TIMEOUT_SECONDS;
    const state: DeploymentState = stale
      ? 'failed'
      : (rawState as DeploymentState);

    return {
      requestId,
      runId: requestId,
      state,
      conclusion: stale
        ? 'timeout'
        : state === 'succeeded'
          ? 'success'
          : state === 'failed'
            ? 'failure'
            : null,
      url: null,
      createdAt: new Date(started * 1_000).toISOString(),
      updatedAt: completedRaw
        ? new Date(Number(completedRaw) * 1_000).toISOString()
        : null,
    };
  }

  private async getTarget(targetId: string): Promise<KeyManagementTarget> {
    const target = await this.targets.get(targetId);
    if (
      target.provider !== 'ssh-env-file' ||
      target.deploymentProvider !== 'ssh-blue-green'
    ) {
      throw new ServiceUnavailableException(
        'SSH blue/green 배포 대상이 아닙니다.',
      );
    }
    return target;
  }

  private assertInput(input: TriggerDeploymentInput): void {
    if (!REQUEST_ID.test(input.requestId) || !VERSION.test(input.version)) {
      throw new ServiceUnavailableException(
        'SSH 배포 요청 식별자가 올바르지 않습니다.',
      );
    }
  }
}
