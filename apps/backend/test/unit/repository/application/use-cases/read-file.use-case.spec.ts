import { NotFoundException } from '@nestjs/common';
import { ReadFileUseCase } from '@/repository/application/use-cases/read-file.use-case';
import type { IProjectRepository } from '@/repository/domain/repositories/project.repository.interface';
import type { IFileStorage } from '@/repository/domain/repositories/file-storage.interface';

function dependencies(content: Buffer, found = true) {
  const projects = {
    findById: jest.fn().mockResolvedValue(found ? { name: 'bigzami' } : null),
  };
  const files = { readFile: jest.fn().mockResolvedValue(content) };
  return {
    projects,
    files,
    useCase: new ReadFileUseCase(
      projects as unknown as IProjectRepository,
      files as unknown as IFileStorage,
    ),
  };
}

describe('ReadFileUseCase', () => {
  it.each([
    '.env',
    '.env.production',
    'config/.env.local',
    '.ENV.TEST',
    '.gitignore',
    '.editorconfig',
  ])(
    'previews the text dotfile %s without changing its content',
    async (file) => {
      const content = 'FIXTURE_VALUE=synthetic-only\n';
      const deps = dependencies(Buffer.from(content));

      await expect(
        deps.useCase.execute('project-id', file, 'owner-id'),
      ).resolves.toEqual({
        path: file,
        size: Buffer.byteLength(content),
        encoding: 'utf8',
        content,
        truncated: false,
      });
      expect(deps.projects.findById).toHaveBeenCalledWith(
        'project-id',
        'owner-id',
      );
      expect(deps.files.readFile).toHaveBeenCalledWith('bigzami', file);
    },
  );

  it('keeps the binary guard for a dotfile containing null bytes', async () => {
    const deps = dependencies(Buffer.from('A=synthetic\0binary'));

    await expect(
      deps.useCase.execute('project-id', '.env', 'owner-id'),
    ).resolves.toMatchObject({
      encoding: 'base64',
      content: '',
      truncated: true,
    });
  });

  it('limits text previews without reporting a truncated original size', async () => {
    const size = 512 * 1024 + 1;
    const deps = dependencies(Buffer.alloc(size, 'x'));
    const result = await deps.useCase.execute('project-id', '.env.production');

    expect(result).toMatchObject({ size, encoding: 'utf8', truncated: true });
    expect(Buffer.byteLength(result.content)).toBe(512 * 1024);
  });

  it('does not read file contents outside the authorized project scope', async () => {
    const deps = dependencies(Buffer.from('FIXTURE_VALUE=synthetic'), false);

    await expect(
      deps.useCase.execute('project-id', '.env', 'another-owner'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(deps.projects.findById).toHaveBeenCalledWith(
      'project-id',
      'another-owner',
    );
    expect(deps.files.readFile).not.toHaveBeenCalled();
  });
});
