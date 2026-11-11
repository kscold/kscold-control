import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import type { SaveDesktopTargetDto } from './presentation/dto/save-desktop-target.dto';
import { randomUUID } from 'node:crypto';
import { SecretEncryptionService } from '../common/crypto/secret-encryption.service';
import {
  defaultBroadcast,
  isPrivateIPv4,
  normalizeMac,
  probeTcp,
  sendMagicPacket,
} from './remote-desktop-network';

interface TargetRow {
  id: string;
  name: string;
  port: number;
  encrypted_credentials: string;
  credentials_iv: string;
  credentials_auth_tag: string;
  host: string | null;
  wake_mac: string | null;
  wake_broadcast: string | null;
  protocol: DesktopProtocol;
}

export type DesktopProtocol = 'vnc' | 'rdp';

export interface DesktopConnection {
  id: string;
  port: number;
  // 없으면 서버 자신(127.0.0.1)
  host?: string;
  protocol: DesktopProtocol;
  credentials?: { username: string; password: string };
}

@Injectable()
export class RemoteDesktopTargetsService {
  private readonly logger = new Logger(RemoteDesktopTargetsService.name);
  private readonly lastWake = new Map<string, number>();
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
      host: null,
      wakeMac: null,
      wakeBroadcast: null,
      protocol: 'vnc' as DesktopProtocol,
    };
  }

  // 입력은 여기서 한 번만 해석하고, 저장된 값은 이 규칙을 통과한 값으로 믿음.
  private network(id: string, input: SaveDesktopTargetDto) {
    const host = input.host?.trim() || null;
    const mac = input.wakeMac?.trim() || null;
    const broadcast = input.wakeBroadcast?.trim() || null;
    const protocol: DesktopProtocol = input.protocol ?? 'vnc';
    if (id === 'local' && (host || mac || broadcast || protocol !== 'vnc'))
      throw new BadRequestException(
        '기본 대상에는 주소와 깨우기 정보를 넣을 수 없습니다.',
      );
    if (host && !isPrivateIPv4(host))
      throw new BadRequestException(
        '주소는 같은 망의 사설 IPv4(10.x, 172.16~31.x, 192.168.x)만 쓸 수 있습니다.',
      );
    const wakeMac = mac && normalizeMac(mac);
    if (mac && !wakeMac)
      throw new BadRequestException('MAC 주소 형식을 확인하세요.');
    if (broadcast && !isPrivateIPv4(broadcast))
      throw new BadRequestException(
        '브로드캐스트 주소는 사설 IPv4만 쓸 수 있습니다.',
      );
    if (wakeMac && !host && !broadcast)
      throw new BadRequestException(
        '깨우려면 주소나 브로드캐스트 주소를 입력하세요.',
      );
    // guacd 는 별도 프로세스라 그쪽의 127.0.0.1 은 이 서버가 아님. RDP 는 주소를 반드시 받음.
    if (protocol === 'rdp' && !host)
      throw new BadRequestException('RDP 대상은 같은 망 주소를 입력하세요.');
    return {
      host,
      wakeMac: wakeMac || null,
      wakeBroadcast: broadcast,
      protocol,
    };
  }

  async list() {
    // 목록에는 암호문과 계정 정보를 포함하지 않음.
    const rows: Array<{
      id: string;
      name: string;
      port: number;
      hasCredentials: boolean;
      host: string | null;
      wakeMac: string | null;
      wakeBroadcast: string | null;
      protocol: DesktopProtocol;
    }> = await this.db.query(
      'SELECT id, name, port, (encrypted_credentials <> \'\') AS "hasCredentials", host, wake_mac AS "wakeMac", wake_broadcast AS "wakeBroadcast", protocol FROM remote_desktop_targets ORDER BY name, id',
    );
    return rows.some((row) => row.id === 'local')
      ? rows
      : [this.local(), ...rows];
  }

  async save(id: string | undefined, input: SaveDesktopTargetDto) {
    if (!input.name.trim())
      throw new BadRequestException('대상 이름을 입력하세요.');
    // 수정할 때 암호를 비우면 저장된 암호를 그대로 씀. 사용자 이름도 비우면 기존 값을 씀.
    const kept =
      input.saveCredentials && !input.password && id
        ? (await this.connection(id)).credentials
        : undefined;
    if (input.saveCredentials && !input.password && !kept)
      throw new BadRequestException('저장할 암호를 입력하세요.');
    const account = kept
      ? { username: input.username || kept.username, password: kept.password }
      : { username: input.username, password: input.password };
    const targetId = id || randomUUID();
    const network = this.network(targetId, input);
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
          JSON.stringify(account),
          `remote-desktop:${targetId}`,
        )
      : { encryptedPayload: '', iv: '', authTag: '' };
    await this.db.query(
      `INSERT INTO remote_desktop_targets (id, name, port, encrypted_credentials, credentials_iv, credentials_auth_tag, host, wake_mac, wake_broadcast, protocol)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, port = EXCLUDED.port,
      encrypted_credentials = EXCLUDED.encrypted_credentials, credentials_iv = EXCLUDED.credentials_iv,
      credentials_auth_tag = EXCLUDED.credentials_auth_tag, host = EXCLUDED.host, wake_mac = EXCLUDED.wake_mac,
      wake_broadcast = EXCLUDED.wake_broadcast, protocol = EXCLUDED.protocol, updated_at = now()`,
      [
        targetId,
        input.name.trim(),
        input.port,
        encrypted.encryptedPayload,
        encrypted.iv,
        encrypted.authTag,
        network.host,
        network.wakeMac,
        network.wakeBroadcast,
        network.protocol,
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

  private async row(id: string): Promise<TargetRow | undefined> {
    const rows: TargetRow[] = await this.db.query(
      'SELECT * FROM remote_desktop_targets WHERE id = $1',
      [id],
    );
    if (!rows[0] && id !== 'local')
      throw new NotFoundException('등록된 원격 대상이 없습니다.');
    return rows[0];
  }

  async status(id: string) {
    const row = await this.row(id);
    const port = row?.port ?? this.local().port;
    return { online: await probeTcp(row?.host || '127.0.0.1', port) };
  }

  async wake(id: string) {
    const row = await this.row(id);
    if (!row?.wake_mac)
      throw new BadRequestException('깨우기 정보가 등록되지 않은 대상입니다.');
    const now = Date.now();
    if (now - (this.lastWake.get(id) ?? 0) < 5_000)
      throw new HttpException(
        '방금 깨우기를 보냈습니다. 잠시 뒤 다시 시도하세요.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    this.lastWake.set(id, now);
    // 저장 시 host 나 broadcast 중 하나는 반드시 있음.
    const broadcast = row.wake_broadcast || defaultBroadcast(row.host!);
    await sendMagicPacket(row.wake_mac, broadcast);
    this.logger.log({ event: 'remote-desktop.wake-sent', targetId: id });
    return { sent: true };
  }

  async connection(id: string): Promise<DesktopConnection> {
    const row = await this.row(id);
    if (!row) return { id: 'local', port: this.local().port, protocol: 'vnc' };
    const base = {
      id,
      port: row.port,
      protocol: row.protocol ?? 'vnc',
      ...(row.host ? { host: row.host } : {}),
    };
    if (!row.encrypted_credentials) return base;
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
      ...base,
      credentials: {
        username: credentials.username,
        password: credentials.password,
      },
    };
  }
}
