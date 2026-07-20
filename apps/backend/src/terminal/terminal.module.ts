import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Domain 계층
import { Session } from './domain/entities/session.entity';
import { Message } from './domain/entities/message.entity';
import { SESSION_REPOSITORY } from './domain/repositories/session.repository.interface';
import { MESSAGE_REPOSITORY } from './domain/repositories/message.repository.interface';
import { SESSION_MANAGER } from './domain/ports/session-manager.port';

// Infrastructure 계층
import { TypeOrmSessionRepository } from './infrastructure/repositories/typeorm-session.repository';
import { TypeOrmMessageRepository } from './infrastructure/repositories/typeorm-message.repository';

// 애플리케이션 서비스
import {
  PtyManagerService,
  SessionMapperService,
  TerminalLimitService,
  TerminalSessionService,
  WorkspaceGitService,
} from './application/services';

// 애플리케이션 유스케이스
import {
  CheckTerminalCommandLimitUseCase,
  ClearTerminalHistoryUseCase,
  CloseTerminalSessionUseCase,
  CreateTerminalSessionUseCase,
  DeleteTerminalSessionUseCase,
  GetOrCreateTerminalSessionUseCase,
  GetTerminalHistoryUseCase,
  LoadTerminalSessionUseCase,
  SaveTerminalMessageUseCase,
  TouchTerminalSessionUseCase,
  UpdateTerminalActivityUseCase,
  ReadWorkspaceFileUseCase,
  WriteWorkspaceFileUseCase,
  ReadWorkspaceTreeUseCase,
  ReadWorkspaceDiffUseCase,
  AcceptWorkspaceDiffUseCase,
  RejectWorkspaceDiffUseCase,
  AcceptWorkspaceDiffHunkUseCase,
  RejectWorkspaceDiffHunkUseCase,
  CommitWorkspaceChangesUseCase,
  CreateWorkspaceBranchUseCase,
  PushWorkspaceBranchUseCase,
} from './application/use-cases';
import { WorkspaceFileController } from './presentation/controllers/workspace-file.controller';

// Presentation 계층
import { TerminalGateway } from './presentation/gateways/terminal.gateway';

// RBAC (유저 리포지토리 + 웹소켓 권한 확인 서비스)
import { RbacModule } from '../rbac/rbac.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Session, Message]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error('JWT_SECRET environment variable is required');
        }
        return {
          secret,
          signOptions: { expiresIn: '7d' },
        };
      },
    }),
    RbacModule,
  ],
  controllers: [WorkspaceFileController],
  providers: [
    // 인프라 (리포지토리 구현체 바인딩)
    { provide: SESSION_REPOSITORY, useClass: TypeOrmSessionRepository },
    { provide: MESSAGE_REPOSITORY, useClass: TypeOrmMessageRepository },

    // 애플리케이션 서비스
    PtyManagerService,
    SessionMapperService,
    TerminalLimitService,
    TerminalSessionService,
    WorkspaceGitService,

    // 세션 매니저 포트 바인딩 — 외부 모듈은 이 토큰으로만 세션 기능에 접근한다
    { provide: SESSION_MANAGER, useExisting: TerminalSessionService },

    // 애플리케이션 유스케이스 (터미널 세션)
    GetOrCreateTerminalSessionUseCase,
    GetTerminalHistoryUseCase,
    SaveTerminalMessageUseCase,
    ClearTerminalHistoryUseCase,
    UpdateTerminalActivityUseCase,
    TouchTerminalSessionUseCase,
    CreateTerminalSessionUseCase,
    LoadTerminalSessionUseCase,
    CloseTerminalSessionUseCase,
    DeleteTerminalSessionUseCase,
    CheckTerminalCommandLimitUseCase,

    // 애플리케이션 유스케이스 (워크스페이스 파일)
    ReadWorkspaceFileUseCase,
    WriteWorkspaceFileUseCase,
    ReadWorkspaceTreeUseCase,
    ReadWorkspaceDiffUseCase,
    AcceptWorkspaceDiffUseCase,
    RejectWorkspaceDiffUseCase,
    AcceptWorkspaceDiffHunkUseCase,
    RejectWorkspaceDiffHunkUseCase,
    CommitWorkspaceChangesUseCase,
    CreateWorkspaceBranchUseCase,
    PushWorkspaceBranchUseCase,

    // Presentation 계층
    TerminalGateway,
  ],
  // 리포지토리 포트와 구현체(TerminalSessionService)는 외부로 노출하지 않는다.
  // 챗 모듈(claude/openai)은 추상인 SESSION_MANAGER 포트를 통해서만
  // 세션/메시지를 다룬다(DIP).
  exports: [SESSION_MANAGER],
})
export class TerminalModule {}
