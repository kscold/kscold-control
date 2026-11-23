import { Logger } from '@nestjs/common';
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
const GCM_IV_BYTES = 12;
const GCM_TAG_BYTES = 16;

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
    const requiredRoles = new Set(
      roles
        .split(',')
        .map((role) => role.trim())
        .filter(Boolean),
    );
    if (requiredRoles.size === 0) {
      new Logger(MfaConfig.name).warn(
        'CONTROL_MFA_REQUIRED_ROLES is empty: no role has to use two-factor login, so a stolen password alone opens any account that has not enrolled',
      );
    }
    return new MfaConfig(
      parseMasterKey(config.get<string>('CONTROL_MFA_ENCRYPTION_KEY')),
      requiredRoles,
      parseIssuer(config.get<string>('CONTROL_MFA_ISSUER')),
    );
  }

  requiresMfa(roles: readonly string[]): boolean {
    return roles.some((role) => this.requiredRoles.has(role));
  }

  newlyRequiresMfa(before: readonly string[], after: readonly string[]) {
    return !this.requiresMfa(before) && this.requiresMfa(after);
  }

  sealSecret(userId: string, secret: string): string {
    const iv = randomBytes(GCM_IV_BYTES);
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
    const ivBytes = Buffer.from(iv ?? '', 'base64');
    const tagBytes = Buffer.from(tag ?? '', 'base64');
    if (
      prefix !== SEALED_PREFIX ||
      ivBytes.length !== GCM_IV_BYTES ||
      tagBytes.length !== GCM_TAG_BYTES ||
      !ciphertext
    ) {
      throw new Error('Unsupported MFA secret format');
    }
    const decipher = createDecipheriv('aes-256-gcm', this.secretKey, ivBytes, {
      authTagLength: GCM_TAG_BYTES,
    });
    decipher.setAAD(Buffer.from(`user-mfa:${userId}`));
    decipher.setAuthTag(tagBytes);
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }

  hashRecoveryCode(normalizedCode: string): string {
    return createHmac('sha256', this.recoveryCodeKey)
      .update(normalizedCode)
      .digest('hex');
  }
}
