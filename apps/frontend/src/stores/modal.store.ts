import { create } from 'zustand';

interface ModalState {
  isOpen: boolean;
  title: string;
  message: string;
  type: 'alert' | 'confirm';
  onConfirm?: () => void;
  onCancel?: () => void;

  // Actions
  showAlert: (message: string, title?: string) => void;
  showConfirm: (message: string, onConfirm: () => void, title?: string) => void;
  close: () => void;
}

export const useModalStore = create<ModalState>((set) => ({
  isOpen: false,
  title: '',
  message: '',
  type: 'alert',
  onConfirm: undefined,
  onCancel: undefined,

  showAlert: (message: string, title = '알림') => {
    set({
      isOpen: true,
      title,
      message,
      type: 'alert',
      onConfirm: undefined,
      onCancel: undefined,
    });
  },

  showConfirm: (message: string, onConfirm: () => void, title = '확인') => {
    set({
      isOpen: true,
      title,
      message,
      type: 'confirm',
      onConfirm,
      onCancel: () => set({ isOpen: false }),
    });
  },

  close: () => {
    set({ isOpen: false });
  },
}));
