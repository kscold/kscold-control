import { AxiosError, type AxiosResponse } from 'axios';
import { api } from '@/shared/api/client';
import { BackupTargetService } from './backup-target.service';

function axiosError(data: unknown, status = 400): AxiosError {
  const error = new AxiosError('Request failed');
  error.response = {
    data,
    status,
    statusText: 'Bad Request',
    headers: {},
    config: { headers: {} },
  } as AxiosResponse;
  return error;
}

describe('BackupTargetService', () => {
  const service = new BackupTargetService();

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('현황을 조회한다', async () => {
    const overview = { timeZone: 'Asia/Seoul', items: [] };
    const get = vi.spyOn(api, 'get').mockResolvedValue({ data: overview });

    await expect(service.getOverview()).resolves.toEqual(overview);
    expect(get).toHaveBeenCalledWith('/backups/targets');
  });

  it('대상을 등록·수정·삭제한다', async () => {
    const target = { id: 'target-1', name: 'app-prod' };
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: target });
    const patch = vi.spyOn(api, 'patch').mockResolvedValue({ data: target });
    const remove = vi.spyOn(api, 'delete').mockResolvedValue({ data: target });
    const input = { name: 'app-prod', uri: 'mongodb://db.example.net/app' };

    await service.createTarget(input);
    await service.updateTarget('target-1', { retentionDays: 30 });
    await service.removeTarget('target-1');

    expect(post).toHaveBeenCalledWith('/backups/targets', input);
    expect(patch).toHaveBeenCalledWith('/backups/targets/target-1', {
      retentionDays: 30,
    });
    expect(remove).toHaveBeenCalledWith('/backups/targets/target-1');
  });

  it('지금 실행은 시작한 기록을 돌려준다', async () => {
    const run = { id: 'run-1', status: 'running' };
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: run });

    await expect(service.runTarget('target-1')).resolves.toEqual(run);
    expect(post).toHaveBeenCalledWith('/backups/targets/target-1/run');
  });

  it('이력 조회 조건을 쿼리로 보낸다', async () => {
    const get = vi
      .spyOn(api, 'get')
      .mockResolvedValue({ data: { items: [{ id: 'run-1' }] } });

    await expect(
      service.listRuns({ targetId: 'target-1', limit: 5 }),
    ).resolves.toEqual([{ id: 'run-1' }]);
    expect(get).toHaveBeenCalledWith('/backups/runs', {
      params: { targetId: 'target-1', limit: 5 },
    });
  });

  it('서버가 보낸 오류 문구를 그대로 전달한다', async () => {
    vi.spyOn(api, 'post').mockRejectedValue(
      axiosError({ message: '같은 이름의 백업 대상이 이미 있습니다.' }, 409),
    );

    await expect(
      service.createTarget({ name: 'app-prod', uri: 'mongodb://db/app' }),
    ).rejects.toThrow('같은 이름의 백업 대상이 이미 있습니다.');
  });

  it('접속 URI 가 담긴 요청의 오류는 콘솔에 남기지 않는다', async () => {
    const logged = vi.mocked(console.error);
    vi.spyOn(api, 'post').mockRejectedValue(axiosError({ message: '실패' }));
    vi.spyOn(api, 'patch').mockRejectedValue(axiosError({ message: '실패' }));

    await service
      .createTarget({ name: 'app-prod', uri: 'mongodb://u:secret@db/app' })
      .catch(() => undefined);
    await service
      .updateTarget('target-1', { uri: 'mongodb://u:secret@db/app' })
      .catch(() => undefined);

    expect(logged).not.toHaveBeenCalled();
  });
});
