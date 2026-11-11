import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RbacModule } from '../../rbac/rbac.module';
import { AuthSessionModule } from '../auth-session.module';
import { MfaChallengeStore } from './application/mfa-challenge.store';
import { MfaService } from './application/mfa.service';
import { MFA_ATTEMPT_GUARD } from './domain/mfa-attempt-guard';
import { UserMfa } from './domain/user-mfa.entity';
import { USER_MFA_REPOSITORY } from './domain/user-mfa.repository.interface';
import { AccountMfaAttemptGuard } from './infrastructure/account-mfa-attempt-guard';
import { TypeOrmUserMfaRepository } from './infrastructure/typeorm-user-mfa.repository';
import { MfaController } from './presentation/mfa.controller';

@Module({
  imports: [TypeOrmModule.forFeature([UserMfa]), AuthSessionModule, RbacModule],
  controllers: [MfaController],
  providers: [
    MfaService,
    MfaChallengeStore,
    { provide: USER_MFA_REPOSITORY, useClass: TypeOrmUserMfaRepository },
    { provide: MFA_ATTEMPT_GUARD, useClass: AccountMfaAttemptGuard },
  ],
  exports: [MfaService],
})
export class MfaModule {}
