import { Module } from '@nestjs/common';
import { SecretEncryptionService } from './secret-encryption.service';

/** 운영 비밀 암호화를 여러 기능 모듈이 함께 쓰도록 내보내는 모듈 */
@Module({
  providers: [SecretEncryptionService],
  exports: [SecretEncryptionService],
})
export class SecretEncryptionModule {}
