import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Project } from './domain/entities/project.entity';
import { PROJECT_REPOSITORY } from './domain/repositories/project.repository.interface';
import { FILE_STORAGE } from './domain/repositories/file-storage.interface';
import { UPLOAD_SESSION_REPOSITORY } from './domain/repositories/upload-session.repository.interface';

import {
  CreateProjectUseCase,
  ListProjectsUseCase,
  DeleteProjectUseCase,
  UploadFilesUseCase,
  CreateUploadSessionUseCase,
  GetUploadSessionUseCase,
  UploadSessionBatchUseCase,
  DownloadArchiveUseCase,
  BrowseTreeUseCase,
  ReadFileUseCase,
  ReadFileAtVersionUseCase,
  ListVersionsUseCase,
  CleanupVersionsUseCase,
  RestoreVersionUseCase,
} from './application/use-cases';

import { TypeOrmProjectRepository } from './infrastructure/repositories/typeorm-project.repository';
import { LocalUploadSessionRepository } from './infrastructure/repositories/local-upload-session.repository';
import { LocalFileStorageService } from './infrastructure/storage/local-file-storage.service';

import { RepositoryController } from './presentation/controllers/repository.controller';

import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Project]), AuthModule],
  controllers: [RepositoryController],
  providers: [
    CreateProjectUseCase,
    ListProjectsUseCase,
    DeleteProjectUseCase,
    UploadFilesUseCase,
    CreateUploadSessionUseCase,
    GetUploadSessionUseCase,
    UploadSessionBatchUseCase,
    DownloadArchiveUseCase,
    BrowseTreeUseCase,
    ReadFileUseCase,
    ReadFileAtVersionUseCase,
    ListVersionsUseCase,
    CleanupVersionsUseCase,
    RestoreVersionUseCase,
    {
      provide: PROJECT_REPOSITORY,
      useClass: TypeOrmProjectRepository,
    },
    {
      provide: FILE_STORAGE,
      useClass: LocalFileStorageService,
    },
    {
      provide: UPLOAD_SESSION_REPOSITORY,
      useClass: LocalUploadSessionRepository,
    },
  ],
})
export class RepositoryModule {}
