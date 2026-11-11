import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
} from 'node:crypto';

const DEFAULT_REQUIRED_ROLES = 'admin,super_admin';
const DEFAULT_ISSUER = 'kscold-control';
const SEALED_PREFIX = 'v1';

function deriveKey(masterKey: Buffer, purpose: string): Buffer {
  return Buffer.from(
    hkdfSync('sha256', masterKey, Buffer.alloc(0), `mfa:${purpose}`, 32),
  );
}

function parseMasterKey(value: string | undefined): Buffer {
  const encoded = value?.trim() ?? '';
  const key = Buffer.from(encoded, 'base64');
  if (key.length !== 32 || key.toString('base64') !== encoded) {
    throw new Error(
      'CONTROL_MFA_ENCRYPTION_KEY must be a base64-encoded 32-byte key (openssl rand -base64 32)',
    );
  }
  return key;
}

function parseIssuer(value: string | undefined): string {
  const issuer = value?.trim() || DEFAULT_ISSUER;
  if (issuer.length > 64 || issuer.includes(':')) {
    throw new Error(
      'CONTROL_MFA_ISSUER must be at most 64 characters without ":"',
    );
  }
  return issuer;
}

/**
 * 2단계 인증 설정과 그 키. 키가 없거나 형식이 틀리면 기동을 멈춘다.
 * 키를 바꾸면 저장된 OTP 비밀값과 복구 코드를 읽을 수 없으니 모든 계정을 비상 해제해야 한다.
 */
export class MfaConfig {
  private readonly secretKey: Buffer;
  private readonly recoveryCodeKey: Buffer;

  constructor(
    masterKey: Buffer,
    readonly requiredRoles: ReadonlySet<string>,
    readonly issuer: string,
  ) {
    this.secretKey = deriveKey(masterKey, 'totp-secret');
    this.recoveryCodeKey = deriveKey(masterKey, 'recovery-code');
  }

  static fromConfig(config: ConfigService): MfaConfig {
    const roles =
      config.get<string>('CONTROL_MFA_REQUIRED_ROLES') ??
      DEFAULT_REQUIRED_ROLES;
    return new MfaConfig(
      parseMasterKey(config.get<string>('CONTROL_MFA_ENCRYPTION_KEY')),
      new Set(
        roles
          .split(',')
          .map((role) => role.trim())
          .filter(Boolean),
      ),
      parseIssuer(config.get<string>('CONTROL_MFA_ISSUER')),
    );
  }

  requiresMfa(roles: readonly string[]): boolean {
    return roles.some((role) => this.requiredRoles.has(role));
  }

  /** 다른 계정 행에 옮겨 붙인 암호문은 풀리지 않도록 사용자 id 에 묶는다. */
  sealSecret(userId: string, secret: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.secretKey, iv);
    cipher.setAAD(Buffer.from(`user-mfa:${userId}`));
    const ciphertext = Buffer.concat([
      cipher.update(secret, 'utf8'),
      cipher.final(),
    ]);
    return [SEALED_PREFIX, iv, cipher.getAuthTag(), ciphertext]
      .map((part) =>
        typeof part === 'string' ? part : part.toString('base64'),
      )
      .join('.');
  }

  openSecret(userId: string, sealed: string): string {
    const [prefix, iv, tag, ciphertext] = sealed.split('.');
    if (prefix !== SEALED_PREFIX || !iv || !tag || !ciphertext) {
      throw new Error('Unsupported MFA secret format');
    }
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.secretKey,
      Buffer.from(iv, 'base64'),
    );
    decipher.setAAD(Buffer.from(`user-mfa:${userId}`));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }

  /** 키를 섞은 해시라 DB 만 빼 간 쪽은 복구 코드를 하나씩 대입해 볼 수 없다. */
  hashRecoveryCode(normalizedCode: string): string {
    return createHmac('sha256', this.recoveryCodeKey)
      .update(normalizedCode)
      .digest('hex');
  }
}
