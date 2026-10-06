import { BackupTargetSecretService } from '@/backup/application/services/backup-target-secret.service';
import { SecretEncryptionService } from '@/common/crypto/secret-encryption.service';

describe('BackupTargetSecretService', () => {
  const uri = 'mongodb+srv://backup:secret-pass@cluster.example.net/prod';
  const encryption = new SecretEncryptionService({
    get: () => Buffer.alloc(32, 7).toString('base64'),
  } as never);
  const service = new BackupTargetSecretService(encryption);

  it('암호화한 URI 를 같은 대상 이름으로 다시 읽는다', () => {
    const sealed = service.seal('app-prod', uri);

    expect(sealed.encryptedUri).not.toContain('secret-pass');
    expect(service.open({ name: 'app-prod', ...sealed })).toBe(uri);
  });

  it('같은 URI 라도 암호화할 때마다 암호문이 달라진다', () => {
    expect(service.seal('app-prod', uri).encryptedUri).not.toBe(
      service.seal('app-prod', uri).encryptedUri,
    );
  });

  it('다른 대상의 암호문을 옮겨 붙이면 읽지 못한다', () => {
    const sealed = service.seal('app-prod', uri);

    expect(() => service.open({ name: 'other-prod', ...sealed })).toThrow(
      '복호화하지 못했습니다',
    );
  });

  it('변조된 암호문은 읽지 못하고, 오류에 암호문을 싣지 않는다', () => {
    const sealed = service.seal('app-prod', uri);
    const tampered = {
      name: 'app-prod',
      ...sealed,
      encryptedUri: Buffer.from('tampered').toString('base64'),
    };

    let message = '';
    try {
      service.open(tampered);
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toContain('복호화하지 못했습니다');
    expect(message).not.toContain(tampered.encryptedUri);
  });
});
