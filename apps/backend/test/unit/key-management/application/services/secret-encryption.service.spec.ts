import { SecretEncryptionService } from '@/key-management/application/services/secret-encryption.service';

describe('SecretEncryptionService', () => {
  const key = Buffer.alloc(32, 7).toString('base64');
  const service = new SecretEncryptionService({
    get: jest.fn().mockReturnValue(key),
  } as any);

  it('AES-256-GCM으로 암호화하고 같은 AAD에서만 복호화한다', () => {
    const encrypted = service.encrypt('SECRET=value\n', 'gole-production:1');

    expect(encrypted.encryptedPayload).not.toContain('SECRET=value');
    expect(
      service.decrypt(
        encrypted.encryptedPayload,
        encrypted.iv,
        encrypted.authTag,
        'gole-production:1',
      ),
    ).toBe('SECRET=value\n');
    expect(() =>
      service.decrypt(
        encrypted.encryptedPayload,
        encrypted.iv,
        encrypted.authTag,
        'gole-production:2',
      ),
    ).toThrow();
  });
});
