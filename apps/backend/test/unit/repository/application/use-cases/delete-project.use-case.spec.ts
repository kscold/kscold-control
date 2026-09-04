import { NotFoundException } from '@nestjs/common';
import { DeleteProjectUseCase } from '@/repository/application/use-cases/delete-project.use-case';

const project = {
  id: 'project-id',
  name: 'source-project',
  description: null,
  ownerId: 'owner-id',
  fileCount: 1,
  totalSize: 10,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function dependencies(found = true) {
  return {
    projects: {
      findById: jest.fn().mockResolvedValue(found ? project : null),
      delete: jest.fn().mockResolvedValue(undefined),
    },
    files: {
      removeProject: jest.fn().mockResolvedValue(undefined),
    },
    sessions: {
      removeByProject: jest.fn().mockResolvedValue(undefined),
    },
  };
}

describe('DeleteProjectUseCase', () => {
  it('소유자 범위를 확인한 뒤 파일, 세션, 프로젝트 레코드를 정리한다', async () => {
    const deps = dependencies();
    const useCase = new DeleteProjectUseCase(
      deps.projects as any,
      deps.files as any,
      deps.sessions as any,
    );

    await useCase.execute(project.id, project.ownerId);

    expect(deps.projects.findById).toHaveBeenCalledWith(
      project.id,
      project.ownerId,
    );
    expect(deps.files.removeProject).toHaveBeenCalledWith(project.name);
    expect(deps.sessions.removeByProject).toHaveBeenCalledWith(project.id);
    expect(deps.projects.delete).toHaveBeenCalledWith(project.id);
  });

  it('조회 범위에 없는 프로젝트는 어떤 데이터도 삭제하지 않는다', async () => {
    const deps = dependencies(false);
    const useCase = new DeleteProjectUseCase(
      deps.projects as any,
      deps.files as any,
      deps.sessions as any,
    );

    await expect(
      useCase.execute(project.id, 'another-owner'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(deps.files.removeProject).not.toHaveBeenCalled();
    expect(deps.sessions.removeByProject).not.toHaveBeenCalled();
    expect(deps.projects.delete).not.toHaveBeenCalled();
  });
});
