import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { RemoteDesktopTargetsService } from '../../../src/remote-desktop/remote-desktop-targets.service';
import { SecretEncryptionService } from '../../../src/common/crypto/secret-encryption.service';
import { sanitizeHttpRequestBody } from '../../../src/common/utils/http-log-sanitizer.util';

describe('저장된 원격 접속 대상', () => {
  const query = jest.fn();
  let service: RemoteDesktopTargetsService;
  let encryption: SecretEncryptionService;
  const input = {
    name: '테스트 맥',
    port: 5901,
    username: 'tester',
    password: 'not-a-real-password',
    saveCredentials: true,
  };

  beforeEach(async () => {
    query.mockReset();
    const module = await Test.createTestingModule({
      providers: [
        RemoteDesktopTargetsService,
        SecretEncryptionService,
        { provide: DataSource, useValue: { query } },
        {
          provide: ConfigService,
          useValue: new ConfigService({
            KEY_MANAGEMENT_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString(
              'base64',
            ),
          }),
        },
      ],
    }).compile();
    service = module.get(RemoteDesktopTargetsService);
    encryption = module.get(SecretEncryptionService);
  });

  it('등록된 대상이 없으면 기본 맥미니를 제공한다', async () => {
    query.mockResolvedValue([]);
    expect(await service.list()).toEqual([
      { id: 'local', name: '맥미니', port: 5900, hasCredentials: false },
    ]);
    expect(query.mock.calls[0][0]).not.toContain('SELECT *');
  });

  it('사용자 이름과 암호는 평문으로 저장하지 않는다', async () => {
    query.mockResolvedValue([]);
    await service.save('local', input);
    const params = query.mock.calls[0][1];
    expect(JSON.stringify(params)).not.toContain(input.username);
    expect(JSON.stringify(params)).not.toContain(input.password);
    expect(
      JSON.parse(
        encryption.decrypt(
          params[3],
          params[4],
          params[5],
          'remote-desktop:local',
        ),
      ),
    ).toEqual({ username: input.username, password: input.password });
  });

  it('접속 시에만 저장된 인증 정보를 복호화한다', async () => {
    const encrypted = encryption.encrypt(
      JSON.stringify({ username: input.username, password: input.password }),
      'remote-desktop:local',
    );
    query.mockResolvedValue([
      {
        id: 'local',
        name: input.name,
        port: 5901,
        encrypted_credentials: encrypted.encryptedPayload,
        credentials_iv: encrypted.iv,
        credentials_auth_tag: encrypted.authTag,
      },
    ]);
    expect(await service.connection('local')).toEqual({
      id: 'local',
      port: 5901,
      credentials: { username: input.username, password: input.password },
    });
  });

  it('다른 대상의 암호문을 복사하면 복호화에 실패한다', async () => {
    const encrypted = encryption.encrypt('{}', 'remote-desktop:other');
    query.mockResolvedValue([
      {
        port: 5901,
        encrypted_credentials: encrypted.encryptedPayload,
        credentials_iv: encrypted.iv,
        credentials_auth_tag: encrypted.authTag,
      },
    ]);
    await expect(service.connection('local')).rejects.toThrow();
  });

  it('저장을 끄면 기존 인증 정보를 비운다', async () => {
    query.mockResolvedValue([]);
    await service.save('local', { ...input, saveCredentials: false });
    expect(query.mock.calls[0][1].slice(3)).toEqual(['', '', '']);
  });

  it('요청 입력값은 실패한 요청에서도 로그에 남기지 않는다', () => {
    const log = JSON.stringify(
      sanitizeHttpRequestBody(
        input,
        'PUT',
        '/api/remote-desktop/targets/local',
      ),
    );
    expect(log).not.toContain(input.password);
    expect(log).not.toContain(input.username);
    expect(log).not.toContain(input.name);
  });

  it('없는 대상에 접속하지 않는다', async () => {
    query.mockResolvedValue([]);
    await expect(service.connection('missing')).rejects.toThrow(
      '등록된 원격 대상이 없습니다.',
    );
  });
});
