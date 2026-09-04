import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SecretBackup } from './domain/entities/secret-backup.entity';
import { DEPLOYMENT_GATEWAY } from './domain/gateways/deployment.gateway.interface';
import { SECRET_STORE_GATEWAY } from './domain/gateways/secret-store.gateway.interface';
import { SECRET_BACKUP_REPOSITORY } from './domain/repositories/secret-backup.repository.interface';
import { EnvDocumentService } from './application/services/env-document.service';
import { KeyManagementService } from './application/services/key-management.service';
import { KeyManagementTargetService } from './application/services/key-management-target.service';
import { SecretEncryptionService } from './application/services/secret-encryption.service';
import { GcpSecretManagerGateway } from './infrastructure/gateways/gcp-secret-manager.gateway';
import { GithubActionsDeploymentGateway } from './infrastructure/gateways/github-actions-deployment.gateway';
import { TypeOrmSecretBackupRepository } from './infrastructure/repositories/typeorm-secret-backup.repository';
import { KeyManagementController } from './presentation/controllers/key-management.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SecretBackup])],
  controllers: [KeyManagementController],
  providers: [
    EnvDocumentService,
    KeyManagementService,
    KeyManagementTargetService,
    SecretEncryptionService,
    {
      provide: SECRET_STORE_GATEWAY,
      useClass: GcpSecretManagerGateway,
    },
    {
      provide: DEPLOYMENT_GATEWAY,
      useClass: GithubActionsDeploymentGateway,
    },
    {
      provide: SECRET_BACKUP_REPOSITORY,
      useClass: TypeOrmSecretBackupRepository,
    },
  ],
})
export class KeyManagementModule {}
