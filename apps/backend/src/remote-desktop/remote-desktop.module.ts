import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';
import { RemoteDesktopService } from './remote-desktop.service';
import { RemoteDesktopController } from './remote-desktop.controller';

@Module({
  imports: [AuthModule, RbacModule],
  controllers: [RemoteDesktopController],
  providers: [RemoteDesktopService],
})
export class RemoteDesktopModule {}
