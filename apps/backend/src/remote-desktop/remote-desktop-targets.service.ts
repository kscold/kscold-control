import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import type { SaveDesktopTargetDto } from './presentation/dto/save-desktop-target.dto';
import { randomUUID } from 'node:crypto';
import { SecretEncryptionService } from '../common/crypto/secret-encryption.service';

interface TargetRow {
  id: string;
  name: string;
  port: number;
  encrypted_credentials: string;
  credentials_iv: string;
  credentials_auth_tag: string;
}

export interface DesktopConnection {
  id: string;
  port: number;
  credentials?: { username: string; password: string };
}

@Injectable()
export class RemoteDesktopTargetsService {
  private readonly logger = new Logger(RemoteDesktopTargetsService.name);
  constructor(
    private readonly db: DataSource,
    private readonly encryption: SecretEncryptionService,
    private readonly config: ConfigService,
  ) {}

  private local() {
    return {
      id: 'local',
      name: '맥미니',
      port: Number(this.config.get<string>('REMOTE_DESKTOP_PORT') || '5900'),
      hasCredentials: false,
    };
  }

  async list() {
    // 목록에는 암호문과 계정 정보를 포함하지 않음.
    const rows: Array<{
      id: string;
      name: string;
      port: number;
      hasCredentials: boolean;
    }> = await this.db.query(
      'SELECT id, name, port, (encrypted_credentials <> \'\') AS "hasCredentials" FROM remote_desktop_targets ORDER BY name, id',
    );
    return rows.some((row) => row.id === 'local')
      ? rows
      : [this.local(), ...rows];
  }

  async save(id: string | undefined, input: SaveDesktopTargetDto) {
    if (!input.name.trim() || (input.saveCredentials && !input.password))
      throw new BadRequestException('대상 이름과 저장할 암호를 입력하세요.');
    const targetId = id || randomUUID();
    if (id && id !== 'local') {
      const existing: Array<{ id: string }> = await this.db.query(
        'SELECT id FROM remote_desktop_targets WHERE id = $1',
        [id],
      );
      if (!existing.length)
        throw new NotFoundException('등록된 원격 대상이 없습니다.');
    }
    const encrypted = input.saveCredentials
      ? this.encryption.encrypt(
          JSON.stringify({
            username: input.username,
            password: input.password,
          }),
          `remote-desktop:${targetId}`,
        )
      : { encryptedPayload: '', iv: '', authTag: '' };
    await this.db.query(
      `INSERT INTO remote_desktop_targets (id, name, port, encrypted_credentials, credentials_iv, credentials_auth_tag)
      VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, port = EXCLUDED.port,
      encrypted_credentials = EXCLUDED.encrypted_credentials, credentials_iv = EXCLUDED.credentials_iv,
      credentials_auth_tag = EXCLUDED.credentials_auth_tag, updated_at = now()`,
      [
        targetId,
        input.name.trim(),
        input.port,
        encrypted.encryptedPayload,
        encrypted.iv,
        encrypted.authTag,
      ],
    );
    this.logger.log({ event: 'remote-desktop.target-saved', targetId });
    return { id: targetId };
  }

  async remove(id: string) {
    await this.db.query('DELETE FROM remote_desktop_targets WHERE id = $1', [
      id,
    ]);
    this.logger.log({ event: 'remote-desktop.target-removed', targetId: id });
    return { removed: true };
  }

  async connection(id: string): Promise<DesktopConnection> {
    const rows: TargetRow[] = await this.db.query(
      'SELECT * FROM remote_desktop_targets WHERE id = $1',
      [id],
    );
    const row = rows[0];
    if (!row) {
      if (id === 'local') return this.local();
      throw new NotFoundException('등록된 원격 대상이 없습니다.');
    }
    if (!row.encrypted_credentials) return { id, port: row.port };
    const credentials: unknown = JSON.parse(
      this.encryption.decrypt(
        row.encrypted_credentials,
        row.credentials_iv,
        row.credentials_auth_tag,
        `remote-desktop:${id}`,
      ),
    );
    if (
      !credentials ||
      typeof credentials !== 'object' ||
      !('username' in credentials) ||
      !('password' in credentials) ||
      typeof credentials.username !== 'string' ||
      typeof credentials.password !== 'string'
    ) {
      throw new Error('저장된 원격 접속 정보가 올바르지 않습니다.');
    }
    return {
      id,
      port: row.port,
      credentials: {
        username: credentials.username,
        password: credentials.password,
      },
    };
  }
}
