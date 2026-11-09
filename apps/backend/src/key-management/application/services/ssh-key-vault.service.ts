import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { SecretEncryptionService } from '../../../common/crypto/secret-encryption.service';
import type { SshKeyVaultEntry } from '../../domain/entities/ssh-key-vault.entity';
import {
  SSH_KEY_INSPECTOR,
  type ISshKeyInspector,
} from '../../domain/gateways/ssh-key-inspector.gateway.interface';
import {
  SSH_KEY_VAULT_REPOSITORY,
  type ISshKeyVaultRepository,
} from '../../domain/repositories/ssh-key-vault.repository.interface';

export interface SshKeySummary {
  id: string;
  name: string;
  description: string;
  publicKey: string;
  fingerprint: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

function associatedData(name: string): string {
  return `ssh-key-vault:${name}`;
}

function toSummary(entry: SshKeyVaultEntry): SshKeySummary {
  return {
    id: entry.id,
    name: entry.name,
    description: entry.description,
    publicKey: entry.publicKey,
    fingerprint: entry.fingerprint,
    createdBy: entry.createdBy,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  };
}

/** 서버 접속용 SSH 키 보관함. 개인 키는 내려받을 때만 복호화한다. */
@Injectable()
export class SshKeyVaultService {
  constructor(
    @Inject(SSH_KEY_VAULT_REPOSITORY)
    private readonly repository: ISshKeyVaultRepository,
    @Inject(SSH_KEY_INSPECTOR)
    private readonly inspector: ISshKeyInspector,
    private readonly encryption: SecretEncryptionService,
  ) {}

  async list(): Promise<SshKeySummary[]> {
    return (await this.repository.findAll()).map(toSummary);
  }

  async create(input: {
    name: string;
    description?: string;
    privateKey: string;
    createdBy: string | null;
  }): Promise<SshKeySummary> {
    const privateKey = `${input.privateKey.replace(/\r\n/g, '\n').trim()}\n`;
    const inspected = await this.inspector.inspect(privateKey);
    if (!inspected) {
      throw new BadRequestException(
        '읽을 수 없는 키입니다. 암호가 없는 OpenSSH 개인 키만 등록할 수 있습니다.',
      );
    }
    if (await this.repository.findByName(input.name)) {
      throw new ConflictException('같은 이름의 SSH 키가 이미 있습니다.');
    }

    const sealed = this.encryption.encrypt(
      privateKey,
      associatedData(input.name),
    );
    const saved = await this.repository.save({
      name: input.name,
      description: input.description?.trim() ?? '',
      publicKey: inspected.publicKey,
      fingerprint: inspected.fingerprint,
      encryptedPrivateKey: sealed.encryptedPayload,
      privateKeyIv: sealed.iv,
      privateKeyAuthTag: sealed.authTag,
      createdBy: input.createdBy,
    });
    return toSummary(saved);
  }

  async download(
    id: string,
  ): Promise<{ name: string; fileName: string; privateKey: string }> {
    const entry = await this.repository.findByIdWithSecret(id);
    if (!entry) {
      throw new NotFoundException('등록되지 않은 SSH 키입니다.');
    }

    try {
      return {
        name: entry.name,
        fileName: entry.name,
        privateKey: this.encryption.decrypt(
          entry.encryptedPrivateKey,
          entry.privateKeyIv,
          entry.privateKeyAuthTag,
          associatedData(entry.name),
        ),
      };
    } catch {
      throw new InternalServerErrorException(
        '저장된 키를 복호화하지 못했습니다. 암호화 키가 바뀌었다면 다시 등록해야 합니다.',
      );
    }
  }

  async remove(id: string): Promise<void> {
    if (!(await this.repository.delete(id))) {
      throw new NotFoundException('등록되지 않은 SSH 키입니다.');
    }
  }
}
