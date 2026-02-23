import { useState } from 'react';

interface CreateUserModalProps {
  show: boolean;
  onClose: () => void;
  onCreate: (email: string, password: string) => Promise<boolean>;
}

/**
 * CreateUserModal Component
 * Modal for creating new users
 */
export function CreateUserModal({
  show,
  onClose,
  onCreate,
}: CreateUserModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (!show) return null;

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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
      <div className="bg-gray-800 rounded-lg p-4 sm:p-6 max-w-md w-full border border-gray-700">
        <h2 className="text-lg sm:text-xl font-bold text-white mb-4">
          새 사용자 생성
        </h2>
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm text-gray-400 mb-2">이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="********"
              className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 outline-none"
            />
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleCreate}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            생성
          </button>
          <button
            onClick={handleCancel}
            className="flex-1 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            취소
          </button>
        </div>
      </div>
    </div>
  );
}
