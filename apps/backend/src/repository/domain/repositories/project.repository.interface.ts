import { Project } from '../entities/project.entity';

export const PROJECT_REPOSITORY = Symbol('PROJECT_REPOSITORY');

export interface IProjectRepository {
  findAll(ownerId?: string): Promise<Project[]>;
  findById(id: string, ownerId?: string): Promise<Project | null>;
  findByName(name: string): Promise<Project | null>;
  create(data: Partial<Project>): Promise<Project>;
  update(id: string, data: Partial<Project>): Promise<Project>;
  delete(id: string): Promise<void>;
}
