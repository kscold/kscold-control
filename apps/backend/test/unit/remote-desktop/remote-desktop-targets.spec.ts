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
      {
        id: 'local',
        name: '맥미니',
        port: 5900,
        hasCredentials: false,
        host: null,
        wakeMac: null,
        wakeBroadcast: null,
        protocol: 'vnc',
      },
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
      protocol: 'vnc',
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
    expect(query.mock.calls[0][1].slice(3, 6)).toEqual(['', '', '']);
  });

  it('수정할 때 암호를 비우면 저장된 암호를 유지하고 사용자 이름만 바꾼다', async () => {
    const encrypted = encryption.encrypt(
      JSON.stringify({ username: 'old-user', password: input.password }),
      'remote-desktop:local',
    );
    query.mockResolvedValueOnce([
      {
        id: 'local',
        port: 5901,
        encrypted_credentials: encrypted.encryptedPayload,
        credentials_iv: encrypted.iv,
        credentials_auth_tag: encrypted.authTag,
      },
    ]);
    query.mockResolvedValue([]);
    await service.save('local', {
      ...input,
      username: 'new-user',
      password: '',
    });
    const params = query.mock.calls[1][1];
    expect(
      JSON.parse(
        encryption.decrypt(
          params[3],
          params[4],
          params[5],
          'remote-desktop:local',
        ),
      ),
    ).toEqual({ username: 'new-user', password: input.password });
  });

  it('저장된 암호가 없으면 빈 암호로 저장하지 않는다', async () => {
    query.mockResolvedValue([]);
    await expect(
      service.save('local', { ...input, password: '' }),
    ).rejects.toThrow('암호');
    await expect(
      service.save(undefined, { ...input, password: '' }),
    ).rejects.toThrow('암호');
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

  it.each([
    '203.0.113.10',
    '127.0.0.1',
    '169.254.0.1',
    '172.32.0.1', // public-source-allow: 사설 대역 경계 확인용
    'pc.example.com',
    '10.0.0',
    '10.0.0.256',
  ])('사설 IPv4가 아닌 주소 %s 는 저장하지 않는다', async (host) => {
    query.mockResolvedValue([{ id: 'second' }]);
    await expect(service.save('second', { ...input, host })).rejects.toThrow(
      '사설 IPv4',
    );
  });

  it('기본 대상의 연결 주소는 바꿀 수 없다', async () => {
    await expect(
      service.save('local', { ...input, host: '10.0.0.5' }),
    ).rejects.toThrow('기본 대상');
  });

  it('RDP 대상은 같은 망 주소가 있어야 하고 기본 대상은 RDP 로 바꿀 수 없다', async () => {
    query.mockResolvedValue([{ id: 'second' }]);
    await expect(
      service.save('second', { ...input, protocol: 'rdp' }),
    ).rejects.toThrow('RDP 대상은');
    await expect(
      service.save('local', { ...input, protocol: 'rdp' }),
    ).rejects.toThrow('기본 대상');
  });

  it('잘못된 MAC 주소는 저장하지 않는다', async () => {
    query.mockResolvedValue([{ id: 'second' }]);
    await expect(
      service.save('second', {
        ...input,
        host: '10.0.0.5',
        wakeMac: '00:00:5E:00:53',
      }),
    ).rejects.toThrow('MAC');
  });

  it('주소와 MAC 을 정규화해 저장하고 연결 정보에 주소를 담는다', async () => {
    query.mockResolvedValue([{ id: 'second' }]);
    await service.save('second', {
      ...input,
      saveCredentials: false,
      host: '10.0.0.20',
      wakeMac: '00-00-5E-00-53-0A',
    });
    expect(query.mock.calls[1][1].slice(6)).toEqual([
      '10.0.0.20',
      '00:00:5e:00:53:0a',
      null,
      'vnc',
    ]);
    query.mockResolvedValue([
      {
        id: 'second',
        port: 3389,
        encrypted_credentials: '',
        host: '10.0.0.5',
        protocol: 'rdp',
      },
    ]);
    expect(await service.connection('second')).toEqual({
      id: 'second',
      port: 3389,
      protocol: 'rdp',
      host: '10.0.0.5',
    });
  });

  it('깨우기 정보가 없는 대상은 깨우지 않는다', async () => {
    query.mockResolvedValue([
      { id: 'second', host: '10.0.0.5', wake_mac: null },
    ]);
    await expect(service.wake('second')).rejects.toThrow('깨우기 정보');
  });
});
