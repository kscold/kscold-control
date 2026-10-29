import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Dialog } from './Dialog';

const pressBackdrop = (dialog: HTMLElement) => {
  const backdrop = dialog.parentElement as HTMLElement;
  fireEvent.mouseDown(backdrop);
  fireEvent.click(backdrop);
};

describe('Dialog', () => {
  it('제목으로 이름 붙은 창을 overflow 가 있는 부모 밖(body)에 띄운다', () => {
    const { container } = render(
      <div style={{ overflow: 'hidden' }}>
        <Dialog open title="정리 대상 추가" onClose={() => {}}>
          본문
        </Dialog>
      </div>,
    );
    expect(
      screen.getByRole('dialog', { name: '정리 대상 추가' }),
    ).toHaveTextContent('본문');
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('닫혀 있으면 아무것도 그리지 않는다', () => {
    render(
      <Dialog open={false} title="숨김" onClose={() => {}}>
        본문
      </Dialog>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('Esc 와 닫기 버튼으로 닫고, 저장 중에는 둘 다 막는다', () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <Dialog open title="양식" onClose={onClose}>
        본문
      </Dialog>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    expect(onClose).toHaveBeenCalledTimes(2);

    rerender(
      <Dialog open busy title="양식" onClose={onClose}>
        본문
      </Dialog>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('button', { name: '닫기' })).toBeDisabled();
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('입력 양식은 바깥을 눌러도 닫히지 않고, 확인 창은 닫힌다', () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <Dialog open title="양식" onClose={onClose}>
        본문
      </Dialog>,
    );
    pressBackdrop(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();

    rerender(
      <Dialog open role="alertdialog" title="확인" onClose={onClose}>
        본문
      </Dialog>,
    );
    pressBackdrop(screen.getByRole('alertdialog'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('창이 겹쳐 열리면 Esc 는 맨 위 창만 닫는다', () => {
    const lower = vi.fn();
    const upper = vi.fn();
    render(
      <>
        <Dialog open title="아래 창" onClose={lower}>
          아래
        </Dialog>
        <Dialog open role="alertdialog" title="위 창" onClose={upper}>
          위
        </Dialog>
      </>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(upper).toHaveBeenCalledTimes(1);
    expect(lower).not.toHaveBeenCalled();
  });

  it('onSubmit 을 주면 아래 버튼 줄까지 form 으로 감싸 제출 버튼이 동작한다', () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <Dialog
        open
        title="이름 바꾸기"
        onClose={() => {}}
        onSubmit={onSubmit}
        footer={<button type="submit">저장</button>}
      >
        <input aria-label="이름" />
      </Dialog>,
    );
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
