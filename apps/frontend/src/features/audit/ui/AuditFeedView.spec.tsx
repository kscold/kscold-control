import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { auditService } from '../api/audit.service';
import type { AuditFeed, AuditFeedItem } from '../model/audit.types';
import { AuditFeedView } from './AuditFeedView';

function item(
  overrides: Partial<AuditFeedItem['event']>,
  extra: Partial<AuditFeedItem> = {},
): AuditFeedItem {
  const createdAt = new Date().toISOString();
  return {
    event: {
      id: overrides.id ?? 'e1',
      domain: 'secrets',
      action: 'secret.reveal',
      summary: 'API_KEY 값을 60초 동안 열람했습니다.',
      actorId: 'u1',
      actorEmail: 'admin@example.com',
      targetType: 'target',
      targetId: 'app-prod',
      metadata: {
        key: 'API_KEY',
        before: { enabled: false },
        after: { enabled: true },
      },
      createdAt,
      ...overrides,
    },
    kind: 'human',
    attention: true,
    count: 1,
    firstAt: createdAt,
    ...extra,
  };
}

const feed: AuditFeed = {
  items: [
    item({}),
    item(
      {
        id: 'e2',
        domain: 'repository',
        action: 'upload.batch.complete',
        summary: '파일을 올렸습니다.',
        metadata: {},
      },
      { attention: false, count: 312 },
    ),
  ],
  counts: { all: 400, attention: 3, human: 320, system: 80 },
  hasMore: false,
};

afterEach(() => vi.restoreAllMocks());

describe('운영 기록 화면', () => {
  it('확인할 일 수와 보기별 수를 보여 주고 반복 기록을 한 줄로 묶어 보여 준다', async () => {
    vi.spyOn(auditService, 'getFeed').mockResolvedValue(feed);
    render(<AuditFeedView />);

    expect(await screen.findByText('확인할 일 3건')).toBeInTheDocument();
    const tabs = screen.getByRole('tablist', { name: '기록 보기' });
    expect(
      within(tabs).getByRole('tab', { name: /사람이 한 일\s*320/ }),
    ).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('312번 반복')).toBeInTheDocument();
  });

  it('확인할 일 카드를 누르면 확인할 일 보기로 다시 불러온다', async () => {
    const getFeed = vi.spyOn(auditService, 'getFeed').mockResolvedValue(feed);
    render(<AuditFeedView />);

    await userEvent.click(await screen.findByText('확인할 일 3건'));
    await waitFor(() =>
      expect(getFeed).toHaveBeenLastCalledWith(
        expect.objectContaining({ view: 'attention' }),
      ),
    );
  });

  it('기록을 누르면 바뀐 내용과 남은 정보를 보여 준다', async () => {
    vi.spyOn(auditService, 'getFeed').mockResolvedValue(feed);
    render(<AuditFeedView />);

    await userEvent.click(
      await screen.findByText('API_KEY 값을 60초 동안 열람했습니다.'),
    );
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('바뀐 내용')).toBeInTheDocument();
    expect(within(dialog).getByText('enabled')).toBeInTheDocument();
    expect(within(dialog).getByText('admin@example.com')).toBeInTheDocument();
  });

  it('불러오기에 실패하면 안내를 보여 준다', async () => {
    vi.spyOn(auditService, 'getFeed').mockRejectedValue(new Error('down'));
    render(<AuditFeedView />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '기록을 불러오지 못했습니다',
    );
  });
});
