import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

export interface EncryptedSecretPayload {
  encryptedPayload: string;
  iv: string;
  authTag: string;
}

@Injectable()
export class SecretEncryptionService {
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    const encodedKey = config.get<string>('KEY_MANAGEMENT_ENCRYPTION_KEY');
    const key = encodedKey
      ? Buffer.from(encodedKey, 'base64')
      : Buffer.alloc(0);
    if (key.length !== 32) {
      throw new Error(
        'KEY_MANAGEMENT_ENCRYPTION_KEY must be a base64-encoded 32-byte key',
      );
    }
    this.key = key;
  }

  encrypt(plaintext: string, associatedData: string): EncryptedSecretPayload {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    cipher.setAAD(Buffer.from(associatedData, 'utf8'));
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);

    return {
      encryptedPayload: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      authTag: cipher.getAuthTag().toString('base64'),
    };
  }

  decrypt(
    encryptedPayload: string,
    iv: string,
    authTag: string,
    associatedData: string,
  ): string {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.key,
      Buffer.from(iv, 'base64'),
    );
    decipher.setAAD(Buffer.from(associatedData, 'utf8'));
    decipher.setAuthTag(Buffer.from(authTag, 'base64'));

    return Buffer.concat([
      decipher.update(Buffer.from(encryptedPayload, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }
}
