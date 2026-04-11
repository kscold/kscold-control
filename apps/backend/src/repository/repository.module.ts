import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Project } from './domain/entities/project.entity';
import { PROJECT_REPOSITORY } from './domain/repositories/project.repository.interface';
import { FILE_STORAGE } from './domain/repositories/file-storage.interface';

import {
  CreateProjectUseCase,
  ListProjectsUseCase,
  DeleteProjectUseCase,
  UploadFilesUseCase,
  DownloadArchiveUseCase,
  BrowseTreeUseCase,
} from './application/use-cases';

import { TypeOrmProjectRepository } from './infrastructure/repositories/typeorm-project.repository';
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
    DownloadArchiveUseCase,
    BrowseTreeUseCase,
    {
      provide: PROJECT_REPOSITORY,
      useClass: TypeOrmProjectRepository,
    },
    {
      provide: FILE_STORAGE,
      useClass: LocalFileStorageService,
    },
  ],
})
export class RepositoryModule {}
