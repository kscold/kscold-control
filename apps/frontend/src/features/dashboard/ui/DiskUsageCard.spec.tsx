import { render, screen } from '@testing-library/react';
import { DiskUsageCard } from './DiskUsageCard';

describe('DiskUsageCard', () => {
  it('디스크와 Docker 세부 수치를 함께 보여준다', () => {
    render(
      <DiskUsageCard
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
                images: { size: 1, reclaimable: 0, active: 0, totalCount: 0 },
                containers: {
                  size: 1,
                  reclaimable: 0,
                  active: 0,
                  totalCount: 0,
                },
                volumes: { size: 1, reclaimable: 0, active: 0, totalCount: 0 },
                buildCache: {
                  size: 1,
                  reclaimable: 0,
                  active: 0,
                  totalCount: 0,
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

    expect(screen.getByText(/저장 경로 기준 Docker/i)).toBeInTheDocument();
    expect(screen.getByText(/엔진 내부 Docker/i)).toBeInTheDocument();
    expect(screen.getByText(/재확보 가능/i)).toBeInTheDocument();
    expect(screen.getAllByTestId('disk-usage-segment')).toHaveLength(4);
    expect(screen.getByText(/Free/i)).toBeInTheDocument();
  });
});
