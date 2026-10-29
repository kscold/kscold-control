import { useState } from 'react';
import {
  DIALOG_INPUT_CLASS,
  DIALOG_LABEL_CLASS,
  Dialog,
  dialogButtonClass,
} from '@/shared/ui';

interface CreateUserModalProps {
  show: boolean;
  onClose: () => void;
  onCreate: (email: string, password: string) => Promise<boolean>;
}

/**
 * 새 사용자를 생성하는 모달
 */
export function CreateUserModal({
  show,
  onClose,
  onCreate,
}: CreateUserModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleCreate = async () => {
    const success = await onCreate(email, password);
    if (success) {
      setEmail('');
      setPassword('');
      onClose();
    }
  };

  const handleCancel = () => {
    setEmail('');
    setPassword('');
    onClose();
  };

  return (
    <Dialog
      open={show}
      title="새 사용자 생성"
      onClose={handleCancel}
      footer={
        <>
          <button
            type="button"
            onClick={handleCancel}
            className={dialogButtonClass()}
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleCreate}
            className={dialogButtonClass('blue')}
          >
            생성
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="create-user-email" className={DIALOG_LABEL_CLASS}>
            이메일
          </label>
          <input
            id="create-user-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            className={DIALOG_INPUT_CLASS}
          />
        </div>
        <div>
          <label htmlFor="create-user-password" className={DIALOG_LABEL_CLASS}>
            비밀번호
          </label>
          <input
            id="create-user-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="********"
            className={DIALOG_INPUT_CLASS}
          />
        </div>
      </div>
    </Dialog>
  );
}
