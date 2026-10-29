import { useModalStore } from '../model/modal.store';
import { Dialog } from './Dialog';
import { dialogButtonClass } from './dialog.styles';

/** 앱 전체에서 쓰는 알림·확인 창 (useModalStore 로 띄운다) */
export const Modal = () => {
  const { isOpen, title, message, type, onConfirm, close } = useModalStore();

  const handleConfirm = () => {
    close();
    if (onConfirm) {
      onConfirm();
    }
  };

  return (
    <Dialog
      open={isOpen}
      role="alertdialog"
      size="sm"
      title={title}
      describedById="global-modal-message"
      onClose={close}
      footer={
        <>
          {type === 'confirm' && (
            <button
              type="button"
              onClick={close}
              className={dialogButtonClass()}
            >
              취소
            </button>
          )}
          <button
            type="button"
            onClick={handleConfirm}
            className={dialogButtonClass('blue')}
          >
            확인
          </button>
        </>
      }
    >
      <p
        id="global-modal-message"
        className="whitespace-pre-wrap break-words text-sm leading-6 text-gray-300"
      >
        {message}
      </p>
    </Dialog>
  );
};
