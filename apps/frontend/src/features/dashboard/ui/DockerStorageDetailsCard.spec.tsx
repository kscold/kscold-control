import { render, screen } from '@testing-library/react';
import { DockerStorageDetailsCard } from './DockerStorageDetailsCard';

describe('DockerStorageDetailsCard', () => {
  it('리소스별 세부 카드와 수집 정보를 함께 보여준다', () => {
    render(
      <DockerStorageDetailsCard
        systemInfo={{
          cpu: { count: 10, model: 'M4' },
          memory: { total: 0, used: 0, free: 0, usedPercent: 0 },
          disk: {
            total: 200 * 1024 ** 3,
            used: 120 * 1024 ** 3,
            available: 80 * 1024 ** 3,
            usedPercent: 60,
            breakdown: {
              docker: 20 * 1024 ** 3,
              applications: 10 * 1024 ** 3,
              other: 90 * 1024 ** 3,
              dockerUsage: {
                total: 15 * 1024 ** 3,
                reclaimable: 4 * 1024 ** 3,
                storageLabel: 'Colima VM',
                storagePath: '/Users/test/.colima',
                storagePathSize: 20 * 1024 ** 3,
                lastCollectedAt: Date.now(),
                collectionState: 'fresh',
                warning: null,
                images: { size: 2, reclaimable: 1, active: 1, totalCount: 3 },
                containers: {
                  size: 3,
                  reclaimable: 0,
                  active: 2,
                  totalCount: 2,
                },
                volumes: { size: 4, reclaimable: 1, active: 4, totalCount: 5 },
                buildCache: {
                  size: 5,
                  reclaimable: 2,
                  active: 0,
                  totalCount: 6,
                },
              },
            },
          },
          platform: 'darwin',
          hostname: 'kscold-mini',
          uptime: 3600,
        }}
      />,
    );

    expect(screen.getByText('Docker 저장소 세부 내역')).toBeInTheDocument();
    expect(screen.getByText('Images')).toBeInTheDocument();
    expect(screen.getByText('Containers')).toBeInTheDocument();
    expect(screen.getByText('Volumes')).toBeInTheDocument();
    expect(screen.getByText('Build Cache')).toBeInTheDocument();
    expect(screen.getByText(/마지막 수집/i)).toBeInTheDocument();
    expect(
      screen.getByText(
        /엔진 내부 사용량과 실제 저장 경로 사용량은 다를 수 있습니다/i,
      ),
    ).toBeInTheDocument();
  });
});
