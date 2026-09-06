import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import {
  AddedSecretVersion,
  ISecretStoreGateway,
  SecretStoreVersion,
} from '../../domain/gateways/secret-store.gateway.interface';
import type {
  KeyManagementTarget,
  SshSecretStoreConfig,
} from '../../domain/types/key-management-target.type';
import { KeyManagementTargetService } from '../../application/services/key-management-target.service';
import {
  shellQuote,
  SshTargetCommandService,
} from './ssh-target-command.service';

@Injectable()
export class SshEnvFileSecretStoreGateway implements ISecretStoreGateway {
  constructor(
    private readonly targets: KeyManagementTargetService,
    private readonly ssh: SshTargetCommandService,
  ) {}

  async readLatest(targetId: string): Promise<SecretStoreVersion> {
    const target = await this.getTarget(targetId);
    return this.readCurrent(target);
  }

  async readVersion(
    targetId: string,
    version: string,
  ): Promise<SecretStoreVersion> {
    this.assertVersion(version);
    const current = await this.readLatest(targetId);
    if (current.version !== version) {
      throw new NotFoundException(
        'SSH 환경 파일의 현재 버전과 요청 버전이 다릅니다.',
      );
    }
    return current;
  }

  async addVersion(
    targetId: string,
    payload: string,
    expectedVersion: string,
  ): Promise<AddedSecretVersion> {
    this.assertVersion(expectedVersion);
    const target = await this.getTarget(targetId);
    const config = target.secretConfig as SshSecretStoreConfig;
    const temporaryPath = `${config.envPath}.kscold-control-${randomUUID()}.tmp`;
    const lockPath = `${config.envPath}.kscold-control.lock`;
    const desiredVersion = this.checksum(payload);
    const command = [
      'set -eu',
      'umask 077',
      `target=${shellQuote(config.envPath)}`,
      `temporary=${shellQuote(temporaryPath)}`,
      `lock=${shellQuote(lockPath)}`,
      `expected=${shellQuote(expectedVersion)}`,
      `desired=${shellQuote(desiredVersion)}`,
      'cleanup() { rm -f -- "$temporary"; }',
      'trap cleanup EXIT HUP INT TERM',
      'exec 9>"$lock"',
      'flock -w 15 9',
      'test -f "$target"',
      'current=$(sha256sum -- "$target" | awk \'{print $1}\')',
      '[ "$current" = "$expected" ] || exit 73',
      'cat >"$temporary"',
      'test -s "$temporary"',
      'chmod 600 "$temporary"',
      'mv -f -- "$temporary" "$target"',
      'trap - EXIT HUP INT TERM',
      'actual=$(sha256sum -- "$target" | awk \'{print $1}\')',
      '[ "$actual" = "$desired" ] || exit 74',
      'printf "%s|%s\\n" "$(stat -c "%Y" -- "$target")" "$actual"',
    ].join('; ');

    try {
      const output = await this.ssh.execute(target, command, {
        input: payload,
        timeoutMs: 30_000,
        maxOutputBytes: 256,
      });
      const [modifiedAt, actualVersion] = output.trim().split('|');
      if (actualVersion !== desiredVersion) {
        throw new ServiceUnavailableException(
          'SSH 환경 파일 반영 후 무결성 검증에 실패했습니다.',
        );
      }
      return {
        version: desiredVersion,
        createdAt: this.toIsoTimestamp(modifiedAt),
      };
    } catch (error) {
      const current = await this.readCurrent(target).catch(() => null);
      if (current?.version === desiredVersion) {
        return { version: desiredVersion, createdAt: current.createdAt };
      }
      if (current && current.version !== expectedVersion) {
        throw new ConflictException(
          'SSH 환경 파일이 다른 작업에서 변경되어 반영을 중단했습니다.',
        );
      }
      throw error;
    }
  }

  private async readCurrent(
    target: KeyManagementTarget,
  ): Promise<SecretStoreVersion> {
    const config = target.secretConfig as SshSecretStoreConfig;
    const command = [
      'set -eu',
      `target=${shellQuote(config.envPath)}`,
      'test -f "$target"',
      'stat -c "%Y" -- "$target"',
      'cat -- "$target"',
    ].join('; ');

    const output = await this.ssh.execute(target, command, {
      timeoutMs: 20_000,
      maxOutputBytes: 256 * 1024,
    });
    const separator = output.indexOf('\n');
    if (separator < 1) {
      throw new ServiceUnavailableException(
        'SSH 환경 파일 응답 형식이 올바르지 않습니다.',
      );
    }
    const payload = output.slice(separator + 1);
    if (!payload) {
      throw new ServiceUnavailableException('SSH 환경 파일이 비어 있습니다.');
    }

    return {
      version: this.checksum(payload),
      payload,
      createdAt: this.toIsoTimestamp(output.slice(0, separator)),
    };
  }

  private async getTarget(targetId: string): Promise<KeyManagementTarget> {
    const target = await this.targets.get(targetId);
    if (target.provider !== 'ssh-env-file') {
      throw new ServiceUnavailableException('SSH 환경 파일 대상이 아닙니다.');
    }
    return target;
  }

  private checksum(payload: string): string {
    return createHash('sha256').update(payload, 'utf8').digest('hex');
  }

  private assertVersion(version: string): void {
    if (!/^[a-f0-9]{64}$/.test(version)) {
      throw new ServiceUnavailableException(
        'SSH 환경 파일 버전 형식이 올바르지 않습니다.',
      );
    }
  }

  private toIsoTimestamp(epoch: string): string {
    if (!/^\d{1,12}$/.test(epoch)) {
      throw new ServiceUnavailableException(
        'SSH 환경 파일 수정 시각을 확인하지 못했습니다.',
      );
    }
    return new Date(Number(epoch) * 1_000).toISOString();
  }
}
