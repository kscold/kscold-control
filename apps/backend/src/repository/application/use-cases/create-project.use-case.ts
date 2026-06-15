import { ConflictException, Inject, Injectable } from '@nestjs/common';
import {
  IProjectRepository,
  PROJECT_REPOSITORY,
} from '../../domain/repositories/project.repository.interface';
import {
  FILE_STORAGE,
  IFileStorage,
} from '../../domain/repositories/file-storage.interface';
import { Project } from '../../domain/entities/project.entity';
import { CreateProjectDto } from '../dto/create-project.dto';

@Injectable()
export class CreateProjectUseCase {
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projectRepository: IProjectRepository,
    @Inject(FILE_STORAGE)
    private readonly fileStorage: IFileStorage,
  ) {}

  async execute(
    dto: CreateProjectDto,
    ownerId: string | null,
  ): Promise<Project> {
    const existing = await this.projectRepository.findByName(dto.name);
    if (existing) {
      throw new ConflictException(`프로젝트 "${dto.name}"이 이미 존재합니다`);
    }

    await this.fileStorage.ensureProject(dto.name);

    return this.projectRepository.create({
      name: dto.name,
      description: dto.description ?? null,
      ownerId,
      fileCount: 0,
      totalSize: 0,
    });
  }
}
