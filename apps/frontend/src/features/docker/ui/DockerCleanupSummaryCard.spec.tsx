import { render, screen } from '@testing-library/react';
import { DockerCleanupSummaryCard } from './DockerCleanupSummaryCard';

describe('DockerCleanupSummaryCard', () => {
  it('요약 수치와 운영 기준을 렌더링한다', () => {
    render(
      <DockerCleanupSummaryCard
        candidates={{
          images: { items: [], totalBytes: 0, reclaimableBytes: 0 },
          containers: { items: [], totalBytes: 0, reclaimableBytes: 0 },
          volumes: { items: [], totalBytes: 0, reclaimableBytes: 0 },
          buildCache: { items: [], totalBytes: 0, reclaimableBytes: 0 },
          composeOrphans: { items: [], totalBytes: 0, reclaimableBytes: 0 },
          artifactFiles: { items: [], totalBytes: 0, reclaimableBytes: 0 },
          warnings: ['Docker 상세 사용량 수집에 실패해서 일부 정보만 표시합니다.'],
          summary: {
            reclaimableBytes: 3 * 1024 ** 3,
            readOnlyBytes: 2 * 1024 ** 3,
            totalCandidates: 9,
            warningCount: 1,
          },
        }}
      />,
    );

    expect(screen.getByText('Docker/배포 부산물 현황')).toBeInTheDocument();
    expect(screen.getByText(/후보 9개/)).toBeInTheDocument();
    expect(screen.getByText(/예상 절감량/)).toBeInTheDocument();
    expect(screen.getByText(/운영 기준/)).toBeInTheDocument();
    expect(screen.getByText(/부분 실패/)).toBeInTheDocument();
  });
});
