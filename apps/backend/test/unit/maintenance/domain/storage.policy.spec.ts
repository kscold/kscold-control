import {
  CONTAINER_LAYER_WARNING_BYTES,
  parseDfUsedBytes,
  parseFstrimBytes,
  sumDeletedOpenFiles,
  toDockerUsageSnapshot,
} from '@/maintenance/domain/policies/storage.policy';

describe('저장공간 정책', () => {
  it('df 출력의 마지막 줄에서 사용 중인 바이트를 읽는다', () => {
    const output =
      '   1B-blocks        Used       Avail\n105087164416 30033080320 69668704256\n';

    expect(parseDfUsedBytes(output)).toBe(30033080320);
    expect(parseDfUsedBytes('df: /var/lib/docker: No such file')).toBeNull();
  });

  it('지워졌지만 열려 있는 일반 파일만 크기를 더한다', () => {
    const output = [
      'p27453',
      'ftxt',
      'tREG',
      's1000',
      'f12',
      'tDIR',
      's4096',
      'f138',
      'tREG',
      's2000',
    ].join('\n');

    expect(sumDeletedOpenFiles(output)).toEqual({ bytes: 3000, files: 2 });
    expect(sumDeletedOpenFiles('')).toEqual({ bytes: 0, files: 0 });
  });

  it('fstrim 출력에서 비운 바이트를 읽는다', () => {
    expect(
      parseFstrimBytes(
        '/var/lib/docker: 63.6 GiB (68308602880 bytes) trimmed\n',
      ),
    ).toBe(68308602880);
    expect(parseFstrimBytes('fstrim: permission denied')).toBeNull();
  });

  it('큰 컨테이너 레이어와 쓰지 않는 이미지·볼륨을 골라낸다', () => {
    const snapshot = toDockerUsageSnapshot({
      Containers: [
        { Names: 'app-small', Image: 'app:1', State: 'running', Size: '130MB' },
        {
          Names: 'app-large',
          Image: 'app:2',
          State: 'running',
          Size: '10.3GB',
        },
      ],
      Images: [
        {
          ID: 'sha256:56de2a6b1d9ff7c3c13a2a',
          Repository: 'app',
          Tag: '1',
          Size: '1.41GB',
          UniqueSize: '964.1MB',
          Containers: '1',
        },
        {
          ID: 'sha256:cdac329d91150dd052e64d',
          Repository: '<none>',
          Tag: '<none>',
          Size: '1.41GB',
          UniqueSize: '964.1MB',
          Containers: '0',
        },
        {
          ID: 'sha256:e9d298c6165e1afbcf2763',
          Repository: 'old-app',
          Tag: 'latest',
          Size: '3.09GB',
          UniqueSize: '3.007GB',
          Containers: '0',
        },
      ],
      Volumes: [
        { Name: 'app-data', Size: '8.4GB', Links: '1', Labels: '' },
        {
          Name: 'old-db',
          Size: '636.6MB',
          Links: '0',
          Labels:
            'com.docker.compose.config-hash=abc,com.docker.compose.project=infra,com.docker.compose.volume=old-db',
        },
      ],
      BuildCache: null,
    });

    expect(snapshot.containers.map((container) => container.name)).toEqual([
      'app-large',
      'app-small',
    ]);
    expect(snapshot.containers[0].oversized).toBe(true);
    expect(snapshot.containers[1].oversized).toBe(false);
    expect(snapshot.containers[0].writableBytes).toBeGreaterThan(
      CONTAINER_LAYER_WARNING_BYTES,
    );
    expect(snapshot.unusedImages).toEqual([
      expect.objectContaining({
        id: 'e9d298c6165e',
        reference: 'old-app:latest',
      }),
      expect.objectContaining({ id: 'cdac329d9115', reference: null }),
    ]);
    expect(snapshot.unreferencedVolumes).toEqual([
      { name: 'old-db', sizeBytes: expect.any(Number), project: 'infra' },
    ]);
    expect(snapshot.buildCacheBytes).toBe(0);
  });
});
