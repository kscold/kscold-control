import { useModalStore } from '../stores/modal.store';

export const Modal = () => {
  const { isOpen, title, message, type, onConfirm, close } = useModalStore();

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
    close();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full border border-gray-700">
        <h2 className="text-xl font-bold text-white mb-4">{title}</h2>
        <p className="text-gray-300 mb-6 whitespace-pre-wrap">{message}</p>

        <div className="flex justify-end gap-3">
          {type === 'confirm' && (
            <button
              onClick={close}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-500 transition-colors"
            >
              취소
            </button>
          )}
          <button
            onClick={handleConfirm}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500 transition-colors"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
};
