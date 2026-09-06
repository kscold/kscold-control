import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RbacModule } from '../rbac/rbac.module';
import { SecretBackup } from './domain/entities/secret-backup.entity';
import { KeyManagementTargetEntity } from './domain/entities/key-management-target.entity';
import { DEPLOYMENT_GATEWAY } from './domain/gateways/deployment.gateway.interface';
import { SECRET_STORE_GATEWAY } from './domain/gateways/secret-store.gateway.interface';
import { KEY_MANAGEMENT_TARGET_REPOSITORY } from './domain/repositories/key-management-target.repository.interface';
import { SECRET_BACKUP_REPOSITORY } from './domain/repositories/secret-backup.repository.interface';
import { EnvDocumentService } from './application/services/env-document.service';
import { KeyManagementService } from './application/services/key-management.service';
import { KeyManagementTargetService } from './application/services/key-management-target.service';
import { SecretEncryptionService } from './application/services/secret-encryption.service';
import { GcpSecretManagerGateway } from './infrastructure/gateways/gcp-secret-manager.gateway';
import { GithubActionsDeploymentGateway } from './infrastructure/gateways/github-actions-deployment.gateway';
import { RoutingDeploymentGateway } from './infrastructure/gateways/routing-deployment.gateway';
import { RoutingSecretStoreGateway } from './infrastructure/gateways/routing-secret-store.gateway';
import { SshBlueGreenDeploymentGateway } from './infrastructure/gateways/ssh-blue-green-deployment.gateway';
import { SshEnvFileSecretStoreGateway } from './infrastructure/gateways/ssh-env-file-secret-store.gateway';
import { SshTargetCommandService } from './infrastructure/gateways/ssh-target-command.service';
import { TypeOrmSecretBackupRepository } from './infrastructure/repositories/typeorm-secret-backup.repository';
import { TypeOrmKeyManagementTargetRepository } from './infrastructure/repositories/typeorm-key-management-target.repository';
import { KeyManagementController } from './presentation/controllers/key-management.controller';
import { KeyManagementTargetAccessGuard } from './presentation/guards/key-management-target-access.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([SecretBackup, KeyManagementTargetEntity]),
    RbacModule,
  ],
  controllers: [KeyManagementController],
  providers: [
    EnvDocumentService,
    KeyManagementService,
    KeyManagementTargetService,
    SecretEncryptionService,
    KeyManagementTargetAccessGuard,
    GcpSecretManagerGateway,
    SshEnvFileSecretStoreGateway,
    SshTargetCommandService,
    GithubActionsDeploymentGateway,
    SshBlueGreenDeploymentGateway,
    {
      provide: SECRET_STORE_GATEWAY,
      useClass: RoutingSecretStoreGateway,
    },
    {
      provide: DEPLOYMENT_GATEWAY,
      useClass: RoutingDeploymentGateway,
    },
    {
      provide: SECRET_BACKUP_REPOSITORY,
      useClass: TypeOrmSecretBackupRepository,
    },
    {
      provide: KEY_MANAGEMENT_TARGET_REPOSITORY,
      useClass: TypeOrmKeyManagementTargetRepository,
    },
  ],
})
export class KeyManagementModule {}
