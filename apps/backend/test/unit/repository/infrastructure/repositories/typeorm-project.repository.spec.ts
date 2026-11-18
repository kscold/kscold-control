import { TypeOrmProjectRepository } from '@/repository/infrastructure/repositories/typeorm-project.repository';

describe('TypeOrmProjectRepository', () => {
  it('프로젝트 목록을 ownerId로 제한한다', async () => {
    const find = vi.fn().mockResolvedValue([]);
    const repository = new TypeOrmProjectRepository({ find } as any);

    await repository.findAll('user-1');

    expect(find).toHaveBeenCalledWith({
      where: { ownerId: 'user-1' },
      order: { updatedAt: 'DESC' },
    });
  });

  it('프로젝트 단건 조회를 ownerId로 제한한다', async () => {
    const findOne = vi.fn().mockResolvedValue(null);
    const repository = new TypeOrmProjectRepository({ findOne } as any);

    await repository.findById('project-1', 'user-1');

    expect(findOne).toHaveBeenCalledWith({
      where: { id: 'project-1', ownerId: 'user-1' },
    });
  });
});
