import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RbacModule } from '../../rbac/rbac.module';
import { LoginGuardService } from '../../security/application/services/login-guard.service';
import { SecurityModule } from '../../security/security.module';
import { AuthSessionModule } from '../auth-session.module';
import { MfaChallengeStore } from './application/services/mfa-challenge.store';
import { MfaService } from './application/services/mfa.service';
import { MFA_ATTEMPT_GUARD } from './domain/policies/mfa-attempt-guard.policy';
import { UserMfa } from './domain/entities/user-mfa.entity';
import { USER_MFA_REPOSITORY } from './domain/repositories/user-mfa.repository.interface';
import { TypeOrmUserMfaRepository } from './infrastructure/repositories/typeorm-user-mfa.repository';
import { MfaController } from './presentation/controllers/mfa.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserMfa]),
    AuthSessionModule,
    RbacModule,
    SecurityModule,
  ],
  controllers: [MfaController],
  providers: [
    MfaService,
    MfaChallengeStore,
    { provide: USER_MFA_REPOSITORY, useClass: TypeOrmUserMfaRepository },
    { provide: MFA_ATTEMPT_GUARD, useExisting: LoginGuardService },
  ],
  exports: [MfaService],
})
export class MfaModule {}
