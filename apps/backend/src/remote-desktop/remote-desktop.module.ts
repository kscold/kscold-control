import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';
import { RemoteDesktopService } from './remote-desktop.service';
import { RemoteDesktopController } from './remote-desktop.controller';
import { SecretEncryptionModule } from '../common/crypto/secret-encryption.module';
import { RemoteDesktopTargetsService } from './remote-desktop-targets.service';

@Module({
  imports: [AuthModule, RbacModule, SecretEncryptionModule],
  controllers: [RemoteDesktopController],
  providers: [RemoteDesktopService, RemoteDesktopTargetsService],
})
export class RemoteDesktopModule {}
