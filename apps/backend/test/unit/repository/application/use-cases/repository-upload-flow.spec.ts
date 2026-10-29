import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  PayloadTooLargeException,
} from '@nestjs/common';
import { Readable } from 'node:stream';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { LocalFileStorageService } from '@/repository/infrastructure/storage/local-file-storage.service';
import { LocalUploadSessionRepository } from '@/repository/infrastructure/repositories/local-upload-session.repository';
import { CreateUploadSessionUseCase } from '@/repository/application/use-cases/create-upload-session.use-case';
import { UploadSessionBatchUseCase } from '@/repository/application/use-cases/upload-session-batch.use-case';
import { FinalizeUploadSessionUseCase } from '@/repository/application/use-cases/finalize-upload-session.use-case';
import { RepositoryUploadCoordinator } from '@/repository/application/services/repository-upload-coordinator.service';
import {
  REPOSITORY_UPLOAD_INTEGRITY_ERROR_CODE,
  RepositoryUploadIntegrityException,
} from '@/repository/application/errors/repository-upload-integrity.exception';
import {
  buildUploadManifestDigest,
  hashUploadBuffer,
} from '@/repository/application/utils/upload-manifest.util';
import {
  REPOSITORY_UPLOAD_PROTOCOL_VERSION,
  RepositoryUploadSession,
} from '@/repository/domain/types/upload-session.type';

const project = {
  id: 'project-id',
  name: 'source-project',
  description: null,
  ownerId: 'owner-id',
  fileCount: 1,
  totalSize: 3,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function metadata(relativePath: string, buffer: Buffer) {
  return {
    relativePath,
    size: buffer.length,
    sha256: hashUploadBuffer(buffer),
  };
}

function makeSession(buffer = Buffer.from('new')): RepositoryUploadSession {
  const file = metadata('src/index.ts', buffer);
  const now = new Date().toISOString();
  return {
    id: '123e4567-e89b-12d3-a456-426614174000',
    protocolVersion: REPOSITORY_UPLOAD_PROTOCOL_VERSION,
    projectId: project.id,
    projectName: project.name,
    status: 'pending',
    manifestDigest: buildUploadManifestDigest([file]),
    replace: true,
    replaceApplied: false,
    totalFiles: 1,
    totalBytes: buffer.length,
    filteredCount: 0,
    batchTotal: 1,
    uploadedCount: 0,
    uploadedBytes: 0,
    failedCount: 0,
    failedFiles: [],
    batches: [
      {
        index: 0,
        totalFiles: 1,
        totalBytes: buffer.length,
        status: 'pending',
        files: [file],
        uploadedCount: 0,
        uploadedBytes: 0,
        failedFiles: [],
        error: null,
        updatedAt: null,
      },
    ],
    currentBatchIndex: null,
    createdAt: now,
    updatedAt: now,
    lastActivityAt: now,
    completedAt: null,
    publishedAt: null,
    snapshotId: null,
    finalizationError: null,
  };
}

function createDependencies(session: RepositoryUploadSession | null = null) {
  let storedSession = session;
  const projectRepository = {
    findById: jest.fn().mockResolvedValue(project),
    update: jest.fn().mockImplementation(async (_id, changes) => ({
      ...project,
      ...changes,
    })),
  };
  const fileStorage = {
    getFreeBytes: jest.fn().mockResolvedValue(Number.MAX_SAFE_INTEGER),
    prepareStagedUpload: jest.fn().mockResolvedValue(undefined),
    writeStagedFile: jest.fn().mockResolvedValue(undefined),
    inspectStagedUpload: jest.fn(),
    finalizeStagedUpload: jest.fn(),
    discardStagedUpload: jest.fn().mockResolvedValue(undefined),
  };
  const sessionRepository = {
    findLatestByProject: jest
      .fn()
      .mockImplementation(async () => storedSession),
    findById: jest.fn().mockImplementation(async () => storedSession),
    create: jest.fn().mockImplementation(async (created) => {
      storedSession = created;
      return created;
    }),
    save: jest.fn().mockImplementation(async (saved) => {
      storedSession = saved;
      return saved;
    }),
  };

  return { projectRepository, fileStorage, sessionRepository };
}

describe('repository upload flow', () => {
  it('env·키·SVG·바이너리를 배치 업로드 후 압축 다운로드·이전 버전까지 원본 그대로 보존한다', async () => {
    const root = await fs.mkdtemp(path.join(tmpdir(), 'repository-roundtrip-'));
    const previousStorage = process.env.REPOSITORY_STORAGE_DIR;
    const previousSessions = process.env.REPOSITORY_UPLOAD_SESSION_DIR;
    process.env.REPOSITORY_STORAGE_DIR = root;
    process.env.REPOSITORY_UPLOAD_SESSION_DIR = path.join(
      root,
      '.upload-sessions',
    );
    try {
      const storage = new LocalFileStorageService();
      await storage.onModuleInit();
      await storage.ensureProject(project.name);
      const sessions = new LocalUploadSessionRepository();
      const { projectRepository } = createDependencies();
      const coordinator = new RepositoryUploadCoordinator();
      const create = new CreateUploadSessionUseCase(
        projectRepository as any,
        storage,
        sessions,
        coordinator,
      );
      const upload = new UploadSessionBatchUseCase(
        projectRepository as any,
        storage,
        sessions,
        coordinator,
      );
      const finalize = new FinalizeUploadSessionUseCase(
        projectRepository as any,
        storage,
        sessions,
        coordinator,
      );
      const contents = new Map([
        ['.env', Buffer.from('TEST_SECRET=fixture-only\n')],
        ['.env.production', Buffer.from('TEST_DATABASE=fixture-only\n')],
        [
          'cert/private.pem',
          Buffer.from(
            '-----BEGIN PRIVATE KEY-----\nfixture-only\n-----END PRIVATE KEY-----\n',
          ),
        ],
        [
          'public/logo.svg',
          Buffer.from(
            `<svg xmlns="http://www.w3.org/2000/svg"><!--${'x'.repeat(1024 ** 2)}--></svg>`,
          ),
        ],
        ['public/image.png', Buffer.from([137, 80, 78, 71, 0, 255])],
        ['public/font.woff2', Buffer.from([119, 79, 70, 50, 0, 255])],
        ['yarn.lock', Buffer.from('# fixture lockfile')],
        ['.vscode/settings.json', Buffer.from('{"editor.tabSize":2}')],
      ]);
      const files = [...contents].map(([relativePath, buffer]) => ({
        relativePath,
        buffer,
        size: buffer.length,
      }));
      const metas = files.map((file) =>
        metadata(file.relativePath, file.buffer),
      );
      const batches = [metas.slice(0, 4), metas.slice(4)].map(
        (batchFiles, index) => ({
          index,
          files: batchFiles,
          totalFiles: batchFiles.length,
          totalBytes: batchFiles.reduce((sum, file) => sum + file.size, 0),
        }),
      );
      const session = await create.execute(
        project.id,
        {
          protocolVersion: REPOSITORY_UPLOAD_PROTOCOL_VERSION,
          replace: true,
          totalFiles: files.length,
          totalBytes: files.reduce((sum, file) => sum + file.size, 0),
          filteredCount: 0,
          manifestDigest: buildUploadManifestDigest(metas),
          batches,
        },
        project.ownerId,
      );
      await upload.execute(
        project.id,
        session.id,
        0,
        files.slice(0, 4),
        project.ownerId,
      );
      await upload.execute(
        project.id,
        session.id,
        0,
        files.slice(0, 4),
        project.ownerId,
      );
      await upload.execute(
        project.id,
        session.id,
        1,
        files.slice(4),
        project.ownerId,
      );
      const result = await finalize.execute(
        project.id,
        session.id,
        project.ownerId,
      );
      expect(result.session.status).toBe('completed');
      expect(result.project.fileCount).toBe(files.length);
      const archive = await storage.archiveProject(project.name);
      const chunks: Buffer[] = [];
      for await (const chunk of archive) chunks.push(Buffer.from(chunk));
      const extracted = path.join(root, 'extracted');
      await fs.mkdir(extracted);
      const tar = spawnSync('tar', ['-xzf', '-', '-C', extracted], {
        input: Buffer.concat(chunks),
      });
      expect(tar.status).toBe(0);
      for (const [relativePath, bytes] of contents) {
        expect(await storage.readFile(project.name, relativePath)).toEqual(
          bytes,
        );
        expect(await fs.readFile(path.join(extracted, relativePath))).toEqual(
          bytes,
        );
      }
      const [version] = await storage.listVersions(project.name);
      await fs.writeFile(path.join(root, project.name, '.env'), 'changed');
      await storage.restoreVersion(project.name, version.id);
      expect(await storage.readFile(project.name, '.env')).toEqual(
        contents.get('.env'),
      );
      expect(await storage.readFile(project.name, 'public/logo.svg')).toEqual(
        contents.get('public/logo.svg'),
      );
    } finally {
      if (previousStorage === undefined)
        delete process.env.REPOSITORY_STORAGE_DIR;
      else process.env.REPOSITORY_STORAGE_DIR = previousStorage;
      if (previousSessions === undefined)
        delete process.env.REPOSITORY_UPLOAD_SESSION_DIR;
      else process.env.REPOSITORY_UPLOAD_SESSION_DIR = previousSessions;
      await fs.rm(root, { recursive: true, force: true });
    }
  }, 30_000);

  it('마지막 배치 응답 유실 후 재전송은 finalizing에서도 멱등 성공한다', async () => {
    const session = makeSession();
    const dependencies = createDependencies(session);
    const useCase = new UploadSessionBatchUseCase(
      dependencies.projectRepository as any,
      dependencies.fileStorage as any,
      dependencies.sessionRepository as any,
      new RepositoryUploadCoordinator(),
    );
    const files = [
      { relativePath: 'src/index.ts', size: 3, buffer: Buffer.from('new') },
    ];
    const first = await useCase.execute(project.id, session.id, 0, files);
    expect(first.session.status).toBe('finalizing');
    const retry = await useCase.execute(project.id, session.id, 0, files);
    expect(retry.uploadedCount).toBe(1);
    expect(retry.session.status).toBe('finalizing');
    expect(dependencies.fileStorage.writeStagedFile).toHaveBeenCalledTimes(1);
  });

  it('v2 세션을 만들기 전에 전체 manifest와 중복 경로를 검증한다', async () => {
    const content = Buffer.from('content');
    const file = metadata('src/index.ts', content);
    const dependencies = createDependencies();
    const useCase = new CreateUploadSessionUseCase(
      dependencies.projectRepository as any,
      dependencies.fileStorage as any,
      dependencies.sessionRepository as any,
      new RepositoryUploadCoordinator(),
    );

    const created = await useCase.execute(project.id, {
      protocolVersion: REPOSITORY_UPLOAD_PROTOCOL_VERSION,
      replace: true,
      totalFiles: 1,
      totalBytes: content.length,
      filteredCount: 2,
      manifestDigest: buildUploadManifestDigest([file]),
      batches: [
        {
          index: 0,
          totalFiles: 1,
          totalBytes: content.length,
          files: [file],
        },
      ],
    });

    expect(created.protocolVersion).toBe(REPOSITORY_UPLOAD_PROTOCOL_VERSION);
    expect(created.batches[0].files[0].sha256).toBe(file.sha256);
    expect(dependencies.fileStorage.prepareStagedUpload).toHaveBeenCalledWith(
      project.name,
      created.id,
      true,
    );

    await expect(
      useCase.execute(project.id, {
        protocolVersion: REPOSITORY_UPLOAD_PROTOCOL_VERSION,
        replace: true,
        totalFiles: 2,
        totalBytes: content.length * 2,
        filteredCount: 0,
        manifestDigest: buildUploadManifestDigest([file, file]),
        batches: [
          {
            index: 0,
            totalFiles: 2,
            totalBytes: content.length * 2,
            files: [file, file],
          },
        ],
      }),
    ).rejects.toThrow('중복된 업로드 파일 경로');
  });

  it('같은 크기라도 내용 SHA-256이 다르면 쓰기 전에 배치를 거부한다', async () => {
    const session = makeSession(Buffer.from('safe'));
    const dependencies = createDependencies(session);
    const useCase = new UploadSessionBatchUseCase(
      dependencies.projectRepository as any,
      dependencies.fileStorage as any,
      dependencies.sessionRepository as any,
      new RepositoryUploadCoordinator(),
    );

    const execution = useCase.execute(project.id, session.id, 0, [
      {
        relativePath: 'src/index.ts',
        size: 4,
        buffer: Buffer.from('evil'),
      },
    ]);

    await expect(execution).rejects.toBeInstanceOf(
      RepositoryUploadIntegrityException,
    );
    await expect(execution).rejects.toMatchObject({
      response: expect.objectContaining({
        code: REPOSITORY_UPLOAD_INTEGRITY_ERROR_CODE,
      }),
    });
    expect(dependencies.fileStorage.writeStagedFile).not.toHaveBeenCalled();
    expect(session.status).toBe('partial_failed');
    expect(session.failedFiles).toEqual(['src/index.ts']);
  });

  it('키 본문이 있어도 무결성이 일치하면 실패 배치를 이어올린다', async () => {
    const content = Buffer.from(
      '-----BEGIN OPENSSH PRIVATE KEY-----\nprivate material',
    );
    const session = makeSession(content);
    session.status = 'partial_failed';
    session.batches[0].status = 'failed';
    session.batches[0].failedFiles = ['src/index.ts'];
    const dependencies = createDependencies(session);
    const useCase = new UploadSessionBatchUseCase(
      dependencies.projectRepository as any,
      dependencies.fileStorage as any,
      dependencies.sessionRepository as any,
      new RepositoryUploadCoordinator(),
    );

    const execution = useCase.execute(project.id, session.id, 0, [
      {
        relativePath: 'src/index.ts',
        size: content.length,
        buffer: content,
      },
    ]);

    await expect(execution).resolves.toMatchObject({ uploadedCount: 1 });
    expect(dependencies.fileStorage.writeStagedFile).toHaveBeenCalledWith(
      project.name,
      session.id,
      'src/index.ts',
      content,
    );
    expect(session.status).toBe('finalizing');
    expect(session.failedFiles).toEqual([]);
  });

  it('배치 완료 시 스테이징에만 쓰고 최종 반영 대기 상태로 전환한다', async () => {
    const content = Buffer.from('safe');
    const session = makeSession(content);
    const dependencies = createDependencies(session);
    const useCase = new UploadSessionBatchUseCase(
      dependencies.projectRepository as any,
      dependencies.fileStorage as any,
      dependencies.sessionRepository as any,
      new RepositoryUploadCoordinator(),
    );

    const result = await useCase.execute(project.id, session.id, 0, [
      {
        relativePath: 'src/index.ts',
        size: content.length,
        buffer: content,
      },
    ]);

    expect(dependencies.fileStorage.writeStagedFile).toHaveBeenCalledTimes(1);
    expect(result.session.status).toBe('finalizing');
    expect(dependencies.projectRepository.update).not.toHaveBeenCalled();
  });

  it('최종 스테이징 검증 실패 시 라이브 교체와 DB 갱신을 하지 않는다', async () => {
    const content = Buffer.from('safe');
    const session = makeSession(content);
    session.status = 'finalizing';
    session.batches[0].status = 'completed';
    session.batches[0].uploadedCount = 1;
    session.batches[0].uploadedBytes = content.length;
    const dependencies = createDependencies(session);
    dependencies.fileStorage.inspectStagedUpload.mockResolvedValue({
      source: 'staging',
      files: [metadata('src/index.ts', Buffer.from('evil'))],
      stats: { fileCount: 1, totalSize: 4 },
    });
    const useCase = new FinalizeUploadSessionUseCase(
      dependencies.projectRepository as any,
      dependencies.fileStorage as any,
      dependencies.sessionRepository as any,
      new RepositoryUploadCoordinator(),
    );

    await expect(
      useCase.execute(project.id, session.id),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(
      dependencies.fileStorage.finalizeStagedUpload,
    ).not.toHaveBeenCalled();
    expect(dependencies.projectRepository.update).not.toHaveBeenCalled();
    expect(dependencies.fileStorage.discardStagedUpload).toHaveBeenCalledWith(
      project.name,
      session.id,
    );
    expect(session.status).toBe('partial_failed');
    expect(session.uploadedCount).toBe(0);
    expect(session.batches[0].status).toBe('pending');
  });

  it('전체 검증 후 라이브 반영, 메타데이터, 스냅샷 ID를 함께 확정한다', async () => {
    const content = Buffer.from('safe');
    const session = makeSession(content);
    const file = metadata('src/index.ts', content);
    session.status = 'finalizing';
    session.batches[0].status = 'completed';
    session.batches[0].uploadedCount = 1;
    session.batches[0].uploadedBytes = content.length;
    const dependencies = createDependencies(session);
    dependencies.fileStorage.inspectStagedUpload.mockResolvedValue({
      source: 'staging',
      files: [file],
      stats: { fileCount: 1, totalSize: content.length },
    });
    dependencies.fileStorage.finalizeStagedUpload.mockResolvedValue({
      stats: { fileCount: 1, totalSize: content.length },
      publishedAt: '2026-09-04T12:00:00.000Z',
      version: {
        id: 'snapshot-id',
        createdAt: new Date('2026-09-04T12:00:00.000Z'),
        compressedSize: 100,
        filename: 'snapshot-id.tar.gz',
      },
    });
    const useCase = new FinalizeUploadSessionUseCase(
      dependencies.projectRepository as any,
      dependencies.fileStorage as any,
      dependencies.sessionRepository as any,
      new RepositoryUploadCoordinator(),
    );

    const result = await useCase.execute(project.id, session.id);

    expect(result.session.status).toBe('completed');
    expect(result.session.snapshotId).toBe('snapshot-id');
    expect(result.session.publishedAt).toBe('2026-09-04T12:00:00.000Z');
    expect(dependencies.projectRepository.update).toHaveBeenCalledWith(
      project.id,
      { fileCount: 1, totalSize: content.length },
    );
  });

  it('이미 반영된 영수증의 라이브가 달라졌으면 세션을 재사용하지 않는다', async () => {
    const content = Buffer.from('safe');
    const session = makeSession(content);
    session.status = 'finalizing';
    session.batches[0].status = 'completed';
    session.batches[0].uploadedCount = 1;
    session.batches[0].uploadedBytes = content.length;
    const dependencies = createDependencies(session);
    dependencies.fileStorage.inspectStagedUpload.mockResolvedValue({
      source: 'published',
      files: [metadata('src/index.ts', Buffer.from('evil'))],
      stats: { fileCount: 1, totalSize: 4 },
    });
    const useCase = new FinalizeUploadSessionUseCase(
      dependencies.projectRepository as any,
      dependencies.fileStorage as any,
      dependencies.sessionRepository as any,
      new RepositoryUploadCoordinator(),
    );

    await expect(useCase.execute(project.id, session.id)).rejects.toThrow(
      '최종 파일 무결성 검증에 실패했습니다',
    );
    expect(dependencies.fileStorage.discardStagedUpload).not.toHaveBeenCalled();
    expect(session.status).toBe('superseded');
    expect(session.replaceApplied).toBe(true);
  });
});

describe('큰 파일 조각 업로드', () => {
  const big = Buffer.from('0123456789abcdef'.repeat(4));
  const small = Buffer.from('small');
  const stream = (buffer: Buffer) => Readable.from([buffer]);

  async function setup() {
    const root = await fs.mkdtemp(path.join(tmpdir(), 'repository-chunked-'));
    const previousStorage = process.env.REPOSITORY_STORAGE_DIR;
    const previousSessions = process.env.REPOSITORY_UPLOAD_SESSION_DIR;
    process.env.REPOSITORY_STORAGE_DIR = root;
    process.env.REPOSITORY_UPLOAD_SESSION_DIR = path.join(
      root,
      '.upload-sessions',
    );
    const storage = new LocalFileStorageService();
    await storage.onModuleInit();
    await storage.ensureProject(project.name);
    const sessions = new LocalUploadSessionRepository();
    const { projectRepository } = createDependencies();
    const coordinator = new RepositoryUploadCoordinator();
    const deps = [
      projectRepository as any,
      storage,
      sessions,
      coordinator,
    ] as const;
    return {
      root,
      storage,
      create: new CreateUploadSessionUseCase(...deps),
      upload: new UploadSessionBatchUseCase(...deps),
      finalize: new FinalizeUploadSessionUseCase(...deps),
      async cleanup() {
        process.env.REPOSITORY_STORAGE_DIR = previousStorage;
        process.env.REPOSITORY_UPLOAD_SESSION_DIR = previousSessions;
        await fs.rm(root, { recursive: true, force: true });
      },
    };
  }

  /** 파일마다 한 배치인 세션 (큰 파일은 조각으로, 작은 파일은 multipart 로 보낸다) */
  function sessionInput(
    batches: Array<Array<{ relativePath: string; buffer: Buffer }>>,
  ) {
    const metas = batches.map((files) =>
      files.map((file) => metadata(file.relativePath, file.buffer)),
    );
    const all = metas.flat();
    return {
      protocolVersion: REPOSITORY_UPLOAD_PROTOCOL_VERSION,
      replace: true,
      totalFiles: all.length,
      totalBytes: all.reduce((sum, file) => sum + file.size, 0),
      filteredCount: 0,
      manifestDigest: buildUploadManifestDigest(all),
      batches: metas.map((files, index) => ({
        index,
        files,
        totalFiles: files.length,
        totalBytes: files.reduce((sum, file) => sum + file.size, 0),
      })),
    };
  }

  it('조각을 이어 받아 해시를 확인한 뒤 반영하고, 끊긴 뒤에는 받은 위치부터 이어 받는다', async () => {
    const env = await setup();
    try {
      const session = await env.create.execute(
        project.id,
        sessionInput([
          [{ relativePath: 'dist/app.war', buffer: big }],
          [{ relativePath: 'README.md', buffer: small }],
        ]),
        project.ownerId,
      );
      await expect(
        env.upload.writeContent(
          project.id,
          session.id,
          0,
          0,
          stream(big.subarray(0, 20)),
          project.ownerId,
        ),
      ).resolves.toMatchObject({ receivedBytes: 20, completed: false });

      // 응답을 못 받고 같은 조각을 다시 보내면 서버가 받은 위치를 알려 준다
      const conflict = await env.upload
        .writeContent(
          project.id,
          session.id,
          0,
          0,
          stream(big.subarray(0, 20)),
          project.ownerId,
        )
        .catch((error: unknown) => error);
      expect(conflict).toBeInstanceOf(ConflictException);
      expect((conflict as ConflictException).getResponse()).toMatchObject({
        receivedBytes: 20,
      });

      const last = await env.upload.writeContent(
        project.id,
        session.id,
        0,
        20,
        stream(big.subarray(20)),
        project.ownerId,
      );
      expect(last).toMatchObject({
        receivedBytes: big.length,
        completed: true,
      });
      expect(last.session.batches[0].status).toBe('completed');
      // 끝난 배치에 다시 보내도 완료로 답한다
      await expect(
        env.upload.writeContent(
          project.id,
          session.id,
          0,
          0,
          stream(big),
          project.ownerId,
        ),
      ).resolves.toMatchObject({ completed: true });

      await env.upload.execute(
        project.id,
        session.id,
        1,
        [{ relativePath: 'README.md', buffer: small, size: small.length }],
        project.ownerId,
      );
      const result = await env.finalize.execute(
        project.id,
        session.id,
        project.ownerId,
      );
      expect(result.session.status).toBe('completed');
      await expect(
        env.storage.readFile(project.name, 'dist/app.war'),
      ).resolves.toEqual(big);
      const parts = await fs
        .readdir(path.join(env.root, '.upload-parts', project.name))
        .catch(() => []);
      expect(parts).toEqual([]);
    } finally {
      await env.cleanup();
    }
  });

  it('다 받은 내용의 해시가 다르면 배치를 실패로 두고 받은 내용을 지운다', async () => {
    const env = await setup();
    try {
      const session = await env.create.execute(
        project.id,
        sessionInput([[{ relativePath: 'dist/app.war', buffer: big }]]),
        project.ownerId,
      );
      await expect(
        env.upload.writeContent(
          project.id,
          session.id,
          0,
          0,
          stream(Buffer.alloc(big.length, 1)),
          project.ownerId,
        ),
      ).rejects.toBeInstanceOf(RepositoryUploadIntegrityException);
      await expect(
        env.storage.stagedContentSize(project.name, session.id, 0),
      ).resolves.toBe(0);
    } finally {
      await env.cleanup();
    }
  });

  it('남은 크기보다 큰 조각은 거절하고 받은 크기를 그대로 둔다', async () => {
    const env = await setup();
    try {
      const session = await env.create.execute(
        project.id,
        sessionInput([[{ relativePath: 'dist/app.war', buffer: big }]]),
        project.ownerId,
      );
      await env.upload.writeContent(
        project.id,
        session.id,
        0,
        0,
        stream(big.subarray(0, 30)),
        project.ownerId,
      );
      await expect(
        env.upload.writeContent(
          project.id,
          session.id,
          0,
          30,
          stream(Buffer.alloc(50, 7)),
          project.ownerId,
        ),
      ).rejects.toBeInstanceOf(PayloadTooLargeException);
      await expect(
        env.storage.stagedContentSize(project.name, session.id, 0),
      ).resolves.toBe(30);
    } finally {
      await env.cleanup();
    }
  });

  it('여러 파일을 묶은 배치에는 조각 업로드를 쓸 수 없다', async () => {
    const env = await setup();
    try {
      const session = await env.create.execute(
        project.id,
        sessionInput([
          [
            { relativePath: 'a.txt', buffer: small },
            { relativePath: 'b.txt', buffer: small },
          ],
        ]),
        project.ownerId,
      );
      await expect(
        env.upload.writeContent(
          project.id,
          session.id,
          0,
          0,
          stream(small),
          project.ownerId,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    } finally {
      await env.cleanup();
    }
  });
});

describe('업로드 세션 서버 정책', () => {
  const huge = (relativePath: string, size: number) => ({
    relativePath,
    size,
    sha256: 'a'.repeat(64),
  });

  function useCaseWith(freeBytes: number) {
    const dependencies = createDependencies();
    dependencies.fileStorage.getFreeBytes.mockResolvedValue(freeBytes);
    return new CreateUploadSessionUseCase(
      dependencies.projectRepository as any,
      dependencies.fileStorage as any,
      dependencies.sessionRepository as any,
      new RepositoryUploadCoordinator(),
    );
  }

  function input(files: ReturnType<typeof huge>[]) {
    return {
      protocolVersion: REPOSITORY_UPLOAD_PROTOCOL_VERSION,
      replace: true,
      totalFiles: files.length,
      totalBytes: files.reduce((sum, file) => sum + file.size, 0),
      filteredCount: 0,
      manifestDigest: buildUploadManifestDigest(files),
      batches: [
        {
          index: 0,
          files,
          totalFiles: files.length,
          totalBytes: files.reduce((sum, file) => sum + file.size, 0),
        },
      ],
    };
  }

  it('50MB 를 넘는 파일 하나짜리 배치도 받는다', async () => {
    const created = await useCaseWith(Number.MAX_SAFE_INTEGER).execute(
      project.id,
      input([huge('dist/app.war', 3 * 1024 ** 3)]),
    );
    expect(created.batches[0].totalBytes).toBe(3 * 1024 ** 3);
  });

  it('여러 파일 배치가 multipart 한도를 넘으면 세션을 만들지 않는다', async () => {
    await expect(
      useCaseWith(Number.MAX_SAFE_INTEGER).execute(
        project.id,
        input([huge('a.bin', 60 * 1024 ** 2), huge('b.bin', 60 * 1024 ** 2)]),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('서버 디스크 여유 공간이 모자라면 507로 거절한다', async () => {
    const rejected = await useCaseWith(1024 ** 3)
      .execute(project.id, input([huge('dist/app.war', 2 * 1024 ** 3)]))
      .catch((error: unknown) => error);
    expect(rejected).toBeInstanceOf(HttpException);
    expect((rejected as HttpException).getStatus()).toBe(
      HttpStatus.INSUFFICIENT_STORAGE,
    );
  });
});
