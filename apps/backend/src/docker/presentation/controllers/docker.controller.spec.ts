import { ROLES } from '../../../common/constants/roles';
import { DockerController } from './docker.controller';

describe('DockerController', () => {
  const createContainerUseCase = { execute: jest.fn() };
  const listContainersUseCase = { execute: jest.fn() };
  const startContainerUseCase = { execute: jest.fn() };
  const stopContainerUseCase = { execute: jest.fn() };
  const removeContainerUseCase = { execute: jest.fn() };
  const importContainerUseCase = { execute: jest.fn() };
  const composeService = {} as any;
  const dockerTopologyService = { getSnapshot: jest.fn() };
  const dockerCleanupService = {
    getCandidates: jest.fn(),
    pruneDanglingImages: jest.fn(),
    pruneBuildCache: jest.fn(),
    pruneExitedContainers: jest.fn(),
    pruneDanglingVolumes: jest.fn(),
  };
  const dockerClient = {} as any;

  const controller = new DockerController(
    createContainerUseCase as any,
    listContainersUseCase as any,
    startContainerUseCase as any,
    stopContainerUseCase as any,
    removeContainerUseCase as any,
    importContainerUseCase as any,
    composeService,
    dockerTopologyService as any,
    dockerCleanupService as any,
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
    const snapshot = { nodes: [{ id: 'host' }], edges: [], summary: { generatedAt: 1 } };
    dockerTopologyService.getSnapshot.mockResolvedValueOnce(snapshot);

    await expect(controller.getTopologySnapshot()).resolves.toEqual(snapshot);
  });

  it('정리 후보를 그대로 반환한다', async () => {
    const candidates = {
      images: { items: [], totalBytes: 0, reclaimableBytes: 0 },
      containers: { items: [], totalBytes: 0, reclaimableBytes: 0 },
      volumes: { items: [], totalBytes: 0, reclaimableBytes: 0 },
      buildCache: { items: [], totalBytes: 0, reclaimableBytes: 0 },
      composeOrphans: { items: [], totalBytes: 0, reclaimableBytes: 0 },
      artifactFiles: { items: [], totalBytes: 0, reclaimableBytes: 0 },
      summary: { reclaimableBytes: 0, readOnlyBytes: 0, totalCandidates: 0 },
    };
    dockerCleanupService.getCandidates.mockResolvedValueOnce(candidates);

    await expect(controller.getCleanupCandidates()).resolves.toEqual(candidates);
  });

  it('이미지 정리는 body가 없으면 dryRun=true로 실행한다', async () => {
    dockerCleanupService.pruneDanglingImages.mockResolvedValueOnce({});

    await controller.pruneDanglingImages();

    expect(dockerCleanupService.pruneDanglingImages).toHaveBeenCalledWith(true);
  });

  it('빌드 캐시 정리는 명시된 dryRun 값을 전달한다', async () => {
    dockerCleanupService.pruneBuildCache.mockResolvedValueOnce({});

    await controller.pruneBuildCache({ dryRun: false });

    expect(dockerCleanupService.pruneBuildCache).toHaveBeenCalledWith(false);
  });

  it('종료된 컨테이너 정리는 body가 없으면 dryRun=true로 실행한다', async () => {
    dockerCleanupService.pruneExitedContainers.mockResolvedValueOnce({});

    await controller.pruneExitedContainers();

    expect(dockerCleanupService.pruneExitedContainers).toHaveBeenCalledWith(true);
  });

  it('dangling 볼륨 정리는 명시된 dryRun 값을 전달한다', async () => {
    dockerCleanupService.pruneDanglingVolumes.mockResolvedValueOnce({});

    await controller.pruneDanglingVolumes({ dryRun: false });

    expect(dockerCleanupService.pruneDanglingVolumes).toHaveBeenCalledWith(false);
  });

  it('컨테이너 생성 시 요청 사용자 id를 dto에 주입한다', async () => {
    const dto = { name: 'test' };
    createContainerUseCase.execute.mockResolvedValueOnce({ id: 'container-1' });

    await controller.createContainer(dto as any, {
      user: { id: 'user-42' },
    } as any);

    expect(createContainerUseCase.execute).toHaveBeenCalledWith({
      ...dto,
      userId: 'user-42',
    });
  });
});
