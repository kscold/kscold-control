import { fireEvent, render, screen } from '@testing-library/react';
import { Modal } from './Modal';
import { useModalStore } from '../model/modal.store';

afterEach(() => useModalStore.getState().close());

it('확인 콜백이 띄우는 다음 알림을 이전 창 닫기로 지우지 않는다', () => {
  useModalStore.getState().showConfirm('실행할까요?', () => {
    useModalStore.getState().showAlert('실패 이유', '작업 실패');
  });
  render(<Modal />);
  fireEvent.click(screen.getByRole('button', { name: '확인' }));
  expect(
    screen.getByRole('alertdialog', { name: '작업 실패' }),
  ).toHaveTextContent('실패 이유');
});

it('overflow가 있는 부모 밖에서 알림을 표시한다', () => {
  useModalStore.getState().showAlert('오류');
  const { container } = render(
    <div style={{ overflow: 'hidden' }}>
      <Modal />
    </div>,
  );
  expect(screen.getByRole('alertdialog')).toBeVisible();
  expect(container.querySelector('[role="alertdialog"]')).toBeNull();
});
