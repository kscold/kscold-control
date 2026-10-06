import { Injectable } from '@nestjs/common';
import { SecretEncryptionService } from '../../../common/crypto/secret-encryption.service';
import type { BackupTarget } from '../../domain/entities/backup-target.entity';
import { backupTargetAssociatedData } from '../../domain/policies/backup-target.policy';
import type { SealedBackupUri } from '../../domain/repositories/backup-target.repository';

/** 백업 대상의 접속 URI 를 저장용으로 암호화하고, 덤프 직전에만 복호화한다. */
@Injectable()
export class BackupTargetSecretService {
  constructor(private readonly encryption: SecretEncryptionService) {}

  seal(targetName: string, uri: string): SealedBackupUri {
    const sealed = this.encryption.encrypt(
      uri,
      backupTargetAssociatedData(targetName),
    );

    return {
      encryptedUri: sealed.encryptedPayload,
      uriIv: sealed.iv,
      uriAuthTag: sealed.authTag,
    };
  }

  /** 암호문 컬럼까지 읽어 온 대상(findByIdWithSecret)에만 쓴다. */
  open(
    target: Pick<
      BackupTarget,
      'name' | 'encryptedUri' | 'uriIv' | 'uriAuthTag'
    >,
  ): string {
    try {
      return this.encryption.decrypt(
        target.encryptedUri,
        target.uriIv,
        target.uriAuthTag,
        backupTargetAssociatedData(target.name),
      );
    } catch {
      // 원인(키 불일치·변조)에는 암호문 일부가 섞일 수 있어 고정 문구만 남긴다.
      throw new Error(
        '저장된 접속 정보를 복호화하지 못했습니다. 암호화 키가 바뀌었다면 접속 URI 를 다시 입력해야 합니다.',
      );
    }
  }
}
