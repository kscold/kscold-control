import { useState } from 'react';
import { Users, Edit2, Key, Trash2 } from 'lucide-react';
import type { User } from '../../../types/domain.types';

interface UserListProps {
  users: User[];
  onAssignRoles: (user: User) => void;
  onUpdatePassword: (userId: string, password: string) => Promise<boolean>;
  onDelete: (userId: string, email: string) => void;
  onResetTerminalLimit: (userId: string) => void;
  onUpdateTerminalLimit: (userId: string, limit: number) => Promise<boolean>;
  onCreateUser: () => void;
}

const getRoleBadgeColor = (roleName: string) => {
  switch (roleName) {
    case 'super_admin':
      return 'bg-purple-600';
    case 'operator':
      return 'bg-blue-600';
    case 'read_only':
      return 'bg-gray-600';
    case 'terminal_only':
      return 'bg-green-600';
    default:
      return 'bg-gray-500';
  }
};

/**
 * UserList Component
 * Displays list of users with inline editing capabilities
 */
export function UserList({
  users,
  onAssignRoles,
  onUpdatePassword,
  onDelete,
  onResetTerminalLimit,
  onUpdateTerminalLimit,
  onCreateUser,
}: UserListProps) {
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editPassword, setEditPassword] = useState('');
  const [editingTerminalLimitId, setEditingTerminalLimitId] = useState<
    string | null
  >(null);
  const [editTerminalLimit, setEditTerminalLimit] = useState<number>(10);

  const handleSavePassword = async (userId: string) => {
    const success = await onUpdatePassword(userId, editPassword);
    if (success) {
      setEditingUserId(null);
      setEditPassword('');
    }
  };

  const handleSaveTerminalLimit = async (userId: string) => {
    const success = await onUpdateTerminalLimit(userId, editTerminalLimit);
    if (success) {
      setEditingTerminalLimitId(null);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-3 sm:p-4 border border-gray-700">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <h2 className="text-base sm:text-lg font-semibold text-white flex items-center gap-2">
          <Users size={18} className="sm:w-5 sm:h-5" />
          사용자 (Users)
        </h2>
        <button
          onClick={onCreateUser}
          className="px-2.5 sm:px-3 py-1.5 bg-blue-600 text-white text-xs sm:text-sm rounded hover:bg-blue-700"
        >
          + 생성
        </button>
      </div>
      <div className="space-y-2 sm:space-y-3">
        {users.map((user) => (
          <div
            key={user.id}
            className="bg-gray-750 p-2.5 sm:p-3 rounded border border-gray-600"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-medium text-sm sm:text-base truncate">
                  {user.email}
                </h3>
                <div className="flex flex-wrap gap-1 mt-2">
                  {user.roles.length > 0 ? (
                    user.roles.map((role) => (
                      <span
                        key={role.id}
                        className={`px-2 py-1 text-xs ${getRoleBadgeColor(role.name)} text-white rounded`}
                      >
                        {role.name}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-gray-500">역할 없음</span>
                  )}
                </div>
                <div className="mt-2 space-y-1">
                  {editingTerminalLimitId === user.id ? (
                    <div className="flex items-center gap-2">
                      <select
                        value={editTerminalLimit}
                        onChange={(e) =>
                          setEditTerminalLimit(parseInt(e.target.value))
                        }
                        className="flex-1 px-2 py-1 text-xs bg-gray-700 text-white rounded border border-gray-600"
                      >
                        <option value="-1">무제한</option>
                        <option value="5">5회</option>
                        <option value="10">10회</option>
                        <option value="20">20회</option>
                        <option value="50">50회</option>
                        <option value="100">100회</option>
                      </select>
                      <button
                        onClick={() => handleSaveTerminalLimit(user.id)}
                        className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                      >
                        저장
                      </button>
                      <button
                        onClick={() => setEditingTerminalLimitId(null)}
                        className="px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700"
                      >
                        취소
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">
                        터미널: {user.terminalCommandCount || 0}/
                        {user.terminalCommandLimit === -1
                          ? '무제한'
                          : user.terminalCommandLimit + '회'}
                      </span>
                      {user.terminalCommandLimit !== -1 && (
                        <button
                          onClick={() => onResetTerminalLimit(user.id)}
                          className="px-2 py-0.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          리셋
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setEditingTerminalLimitId(user.id);
                          setEditTerminalLimit(user.terminalCommandLimit ?? -1);
                        }}
                        className="px-2 py-0.5 text-xs bg-purple-600 text-white rounded hover:bg-purple-700"
                        title="제한 변경"
                      >
                        제한 변경
                      </button>
                    </div>
                  )}
                </div>
                {editingUserId === user.id && (
                  <div className="mt-2 flex gap-2">
                    <input
                      type="password"
                      placeholder="새 비밀번호"
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                      className="flex-1 px-2 py-1 text-sm bg-gray-700 text-white rounded border border-gray-600"
                    />
                    <button
                      onClick={() => handleSavePassword(user.id)}
                      className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      저장
                    </button>
                    <button
                      onClick={() => {
                        setEditingUserId(null);
                        setEditPassword('');
                      }}
                      className="px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700"
                    >
                      취소
                    </button>
                  </div>
                )}
              </div>
              <div className="flex gap-1 ml-2">
                <button
                  onClick={() => onAssignRoles(user)}
                  className="p-2 text-blue-400 hover:text-blue-300"
                  title="역할 수정"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={() => setEditingUserId(user.id)}
                  className="p-2 text-yellow-400 hover:text-yellow-300"
                  title="비밀번호 변경"
                >
                  <Key size={16} />
                </button>
                <button
                  onClick={() => onDelete(user.id, user.email)}
                  className="p-2 text-red-400 hover:text-red-300"
                  title="사용자 삭제"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
