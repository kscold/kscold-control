import { BadRequestException, ConflictException } from '@nestjs/common';
import { SshKeyVaultService } from '../../../../../src/key-management/application/services/ssh-key-vault.service';

describe('SshKeyVaultService', () => {
  const entry = {
    id: 'key-1',
    name: 'pawpong',
    description: '',
    publicKey: 'ssh-ed25519 AAAA',
    fingerprint: 'SHA256:abc',
    createdBy: 'admin@example.com',
    createdAt: new Date('2026-11-09T00:00:00Z'),
    updatedAt: new Date('2026-11-09T00:00:00Z'),
    encryptedPrivateKey: 'cipher',
    privateKeyIv: 'iv',
    privateKeyAuthTag: 'tag',
  };
  const repository = {
    findAll: jest.fn(),
    findByName: jest.fn(),
    findByIdWithSecret: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };
  const inspector = { inspect: jest.fn() };
  const encryption = { encrypt: jest.fn(), decrypt: jest.fn() };
  const service = new SshKeyVaultService(
    repository,
    inspector,
    encryption as never,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    inspector.inspect.mockResolvedValue({
      publicKey: entry.publicKey,
      fingerprint: entry.fingerprint,
    });
    repository.findByName.mockResolvedValue(null);
    repository.save.mockResolvedValue(entry);
    encryption.encrypt.mockReturnValue({
      encryptedPayload: 'cipher',
      iv: 'iv',
      authTag: 'tag',
    });
  });

  it('개인 키를 이름에 묶어 암호화해 저장하고 응답에 싣지 않는다', async () => {
    const result = await service.create({
      name: 'pawpong',
      privateKey: 'secret-key\r\n',
      createdBy: null,
    });

    expect(encryption.encrypt).toHaveBeenCalledWith(
      'secret-key\n',
      'ssh-key-vault:pawpong',
    );
    expect(repository.save.mock.calls[0][0]).not.toHaveProperty('privateKey');
    expect(JSON.stringify(result)).not.toContain('cipher');
    expect(JSON.stringify(result)).not.toContain('secret-key');
  });

  it('읽을 수 없는 키는 저장하지 않는다', async () => {
    inspector.inspect.mockResolvedValue(null);

    await expect(
      service.create({ name: 'bad', privateKey: 'x', createdBy: null }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('같은 이름은 거절한다', async () => {
    repository.findByName.mockResolvedValue(entry);

    await expect(
      service.create({ name: 'pawpong', privateKey: 'x', createdBy: null }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('내려받을 때만 복호화한다', async () => {
    repository.findByIdWithSecret.mockResolvedValue(entry);
    encryption.decrypt.mockReturnValue('plain\n');

    await expect(service.download('key-1')).resolves.toEqual({
      name: 'pawpong',
      fileName: 'pawpong',
      privateKey: 'plain\n',
    });
    expect(encryption.decrypt).toHaveBeenCalledWith(
      'cipher',
      'iv',
      'tag',
      'ssh-key-vault:pawpong',
    );
  });
});
