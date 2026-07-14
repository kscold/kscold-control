import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Domain
import { Session } from './domain/entities/session.entity';
import { Message } from './domain/entities/message.entity';
import { SESSION_REPOSITORY } from './domain/repositories/session.repository.interface';
import { MESSAGE_REPOSITORY } from './domain/repositories/message.repository.interface';

// Infrastructure
import { TypeOrmSessionRepository } from './infrastructure/repositories/typeorm-session.repository';
import { TypeOrmMessageRepository } from './infrastructure/repositories/typeorm-message.repository';

// Application Services
import {
  PtyManagerService,
  SessionMapperService,
  TerminalLimitService,
  TerminalSessionService,
  WorkspaceGitService,
  WsPermissionService,
} from './application/services';

// Application Use-Cases
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

// Presentation
import { TerminalGateway } from './presentation/gateways/terminal.gateway';

// RBAC (for user repository)
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
    // Infrastructure
    { provide: SESSION_REPOSITORY, useClass: TypeOrmSessionRepository },
    { provide: MESSAGE_REPOSITORY, useClass: TypeOrmMessageRepository },

    // Application Services
    PtyManagerService,
    SessionMapperService,
    TerminalLimitService,
    TerminalSessionService,
    WorkspaceGitService,
    WsPermissionService,

    // Application Use-Cases (terminal session)
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

    // Application Use-Cases (workspace file)
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

    // Presentation
    TerminalGateway,
  ],
  // 리포지토리 포트는 외부로 노출하지 않는다 — 챗 모듈(claude/openai)은
  // TerminalSessionService를 경유해 세션/메시지를 다룬다.
  exports: [TerminalSessionService, WsPermissionService],
})
export class TerminalModule {}
