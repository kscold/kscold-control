import { ROLES } from '../../../common/constants/roles';
import { DockerController } from './docker.controller';

describe('DockerController', () => {
  const createContainerUseCase = { execute: jest.fn() };
  const listContainersUseCase = { execute: jest.fn() };
  const startContainerUseCase = { execute: jest.fn() };
  const stopContainerUseCase = { execute: jest.fn() };
  const removeContainerUseCase = { execute: jest.fn() };
  const importContainerUseCase = { execute: jest.fn() };
  const getComposeProvisioningTemplateUseCase = { execute: jest.fn() };
  const createComposeServiceUseCase = { execute: jest.fn() };
  const removeComposeServiceUseCase = { execute: jest.fn() };
  const listComposeServicesUseCase = { execute: jest.fn() };
  const getTopologySnapshotUseCase = { execute: jest.fn() };
  const saveTopologyLayoutUseCase = { execute: jest.fn() };
  const getDockerCleanupCandidatesUseCase = { execute: jest.fn() };
  const pruneDanglingImagesUseCase = { execute: jest.fn() };
  const pruneBuildCacheUseCase = { execute: jest.fn() };
  const pruneExitedContainersUseCase = { execute: jest.fn() };
  const pruneDanglingVolumesUseCase = { execute: jest.fn() };
  const dockerClient = {} as any;

  const controller = new DockerController(
    createContainerUseCase as any,
    listContainersUseCase as any,
    startContainerUseCase as any,
    stopContainerUseCase as any,
    removeContainerUseCase as any,
    importContainerUseCase as any,
    getComposeProvisioningTemplateUseCase as any,
    createComposeServiceUseCase as any,
    removeComposeServiceUseCase as any,
    listComposeServicesUseCase as any,
    getTopologySnapshotUseCase as any,
    saveTopologyLayoutUseCase as any,
    getDockerCleanupCandidatesUseCase as any,
    pruneDanglingImagesUseCase as any,
    pruneBuildCacheUseCase as any,
    pruneExitedContainersUseCase as any,
    pruneDanglingVolumesUseCase as any,
    dockerClient,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('일반 사용자는 자신의 컨테이너만 조회한다', async () => {
    listContainersUseCase.execute.mockResolvedValueOnce([]);

    await controller.listContainers({
      user: { id: 'user-1', roles: ['admin'] },
    } as any);

    expect(listContainersUseCase.execute).toHaveBeenCalledWith('user-1');
  });

  it('슈퍼 어드민은 전체 컨테이너를 조회한다', async () => {
    listContainersUseCase.execute.mockResolvedValueOnce([]);

    await controller.listContainers({
      user: { id: 'user-1', roles: [ROLES.SUPER_ADMIN] },
    } as any);

    expect(listContainersUseCase.execute).toHaveBeenCalledWith(undefined);
  });

  it('토폴로지 스냅샷을 그대로 반환한다', async () => {
    const snapshot = {
      nodes: [{ id: 'host' }],
      edges: [],
      summary: { generatedAt: 1 },
    };
    getTopologySnapshotUseCase.execute.mockResolvedValueOnce(snapshot);

    await expect(
      controller.getTopologySnapshot({
        user: { id: 'user-1' },
      } as any),
    ).resolves.toEqual(snapshot);
    expect(getTopologySnapshotUseCase.execute).toHaveBeenCalledWith('user-1');
  });

  it('정리 후보를 그대로 반환한다', async () => {
    const candidates = {
      images: { items: [], totalBytes: 0, reclaimableBytes: 0 },
      containers: { items: [], totalBytes: 0, reclaimableBytes: 0 },
      volumes: { items: [], totalBytes: 0, reclaimableBytes: 0 },
      buildCache: { items: [], totalBytes: 0, reclaimableBytes: 0 },
      composeOrphans: { items: [], totalBytes: 0, reclaimableBytes: 0 },
      artifactFiles: { items: [], totalBytes: 0, reclaimableBytes: 0 },
      summary: {
        reclaimableBytes: 0,
        readOnlyBytes: 0,
        totalCandidates: 0,
        warningCount: 0,
      },
      warnings: [],
    };
    getDockerCleanupCandidatesUseCase.execute.mockResolvedValueOnce(candidates);

    await expect(controller.getCleanupCandidates()).resolves.toEqual(
      candidates,
    );
  });

  it('이미지 정리는 body가 없으면 dryRun=true로 실행한다', async () => {
    pruneDanglingImagesUseCase.execute.mockResolvedValueOnce({});

    await controller.pruneDanglingImages();

    expect(pruneDanglingImagesUseCase.execute).toHaveBeenCalledWith(true);
  });

  it('빌드 캐시 정리는 명시된 dryRun 값을 전달한다', async () => {
    pruneBuildCacheUseCase.execute.mockResolvedValueOnce({});

    await controller.pruneBuildCache({ dryRun: false });

    expect(pruneBuildCacheUseCase.execute).toHaveBeenCalledWith(false);
  });

  it('종료된 컨테이너 정리는 body가 없으면 dryRun=true로 실행한다', async () => {
    pruneExitedContainersUseCase.execute.mockResolvedValueOnce({});

    await controller.pruneExitedContainers();

    expect(pruneExitedContainersUseCase.execute).toHaveBeenCalledWith(true);
  });

  it('dangling 볼륨 정리는 명시된 dryRun 값을 전달한다', async () => {
    pruneDanglingVolumesUseCase.execute.mockResolvedValueOnce({});

    await controller.pruneDanglingVolumes({ dryRun: false });

    expect(pruneDanglingVolumesUseCase.execute).toHaveBeenCalledWith(false);
  });

  it('컨테이너 생성 시 요청 사용자 id를 dto에 주입한다', async () => {
    const dto = { name: 'test' };
    createContainerUseCase.execute.mockResolvedValueOnce({ id: 'container-1' });

    await controller.createContainer(
      dto as any,
      {
        user: { id: 'user-42' },
      } as any,
    );

    expect(createContainerUseCase.execute).toHaveBeenCalledWith({
      ...dto,
      userId: 'user-42',
    });
  });

  it('compose 생성 기본값을 유스케이스에 위임한다', async () => {
    getComposeProvisioningTemplateUseCase.execute.mockResolvedValueOnce({
      name: 'ubuntu-260405',
    });

    await expect(controller.getComposeProvisioningTemplate()).resolves.toEqual({
      name: 'ubuntu-260405',
    });
  });

  it('compose 서비스 생성은 전용 유스케이스에 위임한다', async () => {
    createComposeServiceUseCase.execute.mockResolvedValueOnce({
      output: 'created',
      container: { id: 'container-1' },
    });

    const result = await controller.addComposeService(
      {
        name: 'ubuntu-e2e',
        image: 'ubuntu:22.04',
        ports: { '22': 2227, '8080': 8085 },
        cpus: '2',
        memLimit: '4g',
      },
      {
        user: { id: 'user-1' },
      } as any,
    );

    expect(createComposeServiceUseCase.execute).toHaveBeenCalledWith(
      {
        name: 'ubuntu-e2e',
        image: 'ubuntu:22.04',
        ports: { '22': 2227, '8080': 8085 },
        cpus: '2',
        memLimit: '4g',
      },
      'user-1',
    );
    expect(result.success).toBe(true);
  });

  it('compose 서비스 삭제는 전용 유스케이스에 위임한다', async () => {
    removeComposeServiceUseCase.execute.mockResolvedValueOnce({
      output: 'removed',
    });

    await controller.removeComposeService('ubuntu-e2e');

    expect(removeComposeServiceUseCase.execute).toHaveBeenCalledWith(
      'ubuntu-e2e',
    );
  });
});
