import { useState, useEffect } from 'react';
import { Shield, Users, Key, Edit2, Trash2 } from 'lucide-react';
import { useModalStore } from '../stores/modal.store';
import { api } from '../lib/api';

interface Permission {
  id: string;
  name: string;
  description: string;
}

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
}

interface User {
  id: string;
  email: string;
  roles: Role[];
  terminalCommandCount?: number;
  terminalCommandLimit?: number;
}

export function RbacDashboard() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editPassword, setEditPassword] = useState('');
  const [editingTerminalLimitId, setEditingTerminalLimitId] = useState<
    string | null
  >(null);
  const [editTerminalLimit, setEditTerminalLimit] = useState<number>(10);
  const { showAlert, showConfirm } = useModalStore();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [rolesRes, permsRes, usersRes] = await Promise.all([
        api.get('/rbac/roles'),
        api.get('/rbac/permissions'),
        api.get('/rbac/users'),
      ]);
      setRoles(rolesRes.data);
      setPermissions(permsRes.data);
      setUsers(usersRes.data);
    } catch (error) {
      console.error('Failed to load RBAC data:', error);
    }
  };

  const handleAssignRoles = async () => {
    if (!selectedUser) return;
    try {
      await api.post(`/rbac/users/${selectedUser.id}/roles`, {
        roleIds: selectedRoleIds,
      });
      await loadData();
      setSelectedUser(null);
      setSelectedRoleIds([]);
    } catch (error) {
      console.error('Failed to assign roles:', error);
      showAlert('역할 할당 실패');
    }
  };

  const handleCreateUser = async () => {
    if (!newUserEmail || !newUserPassword) {
      showAlert('이메일과 비밀번호를 입력하세요');
      return;
    }
    try {
      await api.post('/rbac/users', {
        email: newUserEmail,
        password: newUserPassword,
      });
      await loadData();
      setIsCreatingUser(false);
      setNewUserEmail('');
      setNewUserPassword('');
    } catch (error: any) {
      console.error('Failed to create user:', error);
      showAlert(error.response?.data?.message || '사용자 생성 실패');
    }
  };

  const handleUpdatePassword = async (userId: string) => {
    if (!editPassword) {
      showAlert('새 비밀번호를 입력하세요');
      return;
    }
    try {
      await api.put(`/rbac/users/${userId}`, { password: editPassword });
      await loadData();
      setEditingUserId(null);
      setEditPassword('');
      showAlert('비밀번호가 변경되었습니다');
    } catch (error) {
      console.error('Failed to update password:', error);
      showAlert('비밀번호 변경 실패');
    }
  };

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    showConfirm(
      `정말 ${userEmail} 사용자를 삭제하시겠습니까?`,
      async () => {
        try {
          await api.delete(`/rbac/users/${userId}`);
          await loadData();
        } catch (error) {
          console.error('Failed to delete user:', error);
          showAlert('사용자 삭제 실패');
        }
      },
      '사용자 삭제',
    );
  };

  const handleResetTerminalLimit = async (userId: string) => {
    try {
      await api.post(`/rbac/users/${userId}/reset-terminal-limit`, {});
      await loadData();
      showAlert('터미널 명령어 카운트가 리셋되었습니다');
    } catch (error) {
      console.error('Failed to reset terminal limit:', error);
      showAlert('터미널 제한 리셋 실패');
    }
  };

  const handleUpdateTerminalLimit = async (userId: string) => {
    try {
      await api.put(`/rbac/users/${userId}/terminal-limit`, {
        limit: editTerminalLimit,
      });
      await loadData();
      setEditingTerminalLimitId(null);
      showAlert(
        `터미널 제한이 ${editTerminalLimit === -1 ? '무제한' : editTerminalLimit + '회'}로 변경되었습니다`,
      );
    } catch (error) {
      console.error('Failed to update terminal limit:', error);
      showAlert('터미널 제한 변경 실패');
    }
  };

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

  return (
    <div className="flex flex-col h-full p-3 sm:p-4 lg:p-6 bg-gray-900 overflow-auto">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-white flex items-center gap-2">
          <Shield size={24} className="sm:w-7 sm:h-7" />
          RBAC 권한 관리
        </h1>
        <p className="text-xs sm:text-sm text-gray-400 mt-1">
          사용자 역할 및 권한 제어
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* 역할 목록 */}
        <div className="bg-gray-800 rounded-lg p-3 sm:p-4 border border-gray-700">
          <h2 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4 flex items-center gap-2">
            <Key size={18} className="sm:w-5 sm:h-5" />
            역할 (Roles)
          </h2>
          <div className="space-y-2 sm:space-y-3">
            {roles.map((role) => (
              <div
                key={role.id}
                className="bg-gray-750 p-2.5 sm:p-3 rounded border border-gray-600"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="text-white font-medium text-sm sm:text-base">
                      {role.name}
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-400">
                      {role.description}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {role.permissions.map((perm) => (
                    <span
                      key={perm.id}
                      className="px-1.5 sm:px-2 py-0.5 sm:py-1 text-xs bg-blue-900 text-blue-200 rounded"
                      title={perm.description}
                    >
                      {perm.name}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 사용자 목록 */}
        <div className="bg-gray-800 rounded-lg p-3 sm:p-4 border border-gray-700">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h2 className="text-base sm:text-lg font-semibold text-white flex items-center gap-2">
              <Users size={18} className="sm:w-5 sm:h-5" />
              사용자 (Users)
            </h2>
            <button
              onClick={() => setIsCreatingUser(true)}
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
                            className={`px-2 py-1 text-xs ${getRoleBadgeColor(
                              role.name,
                            )} text-white rounded`}
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
                            onClick={() => handleUpdateTerminalLimit(user.id)}
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
                              onClick={() => handleResetTerminalLimit(user.id)}
                              className="px-2 py-0.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                            >
                              리셋
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setEditingTerminalLimitId(user.id);
                              setEditTerminalLimit(
                                user.terminalCommandLimit ?? -1,
                              );
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
                          onClick={() => handleUpdatePassword(user.id)}
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
                      onClick={() => {
                        setSelectedUser(user);
                        setSelectedRoleIds(user.roles.map((r) => r.id));
                      }}
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
                      onClick={() => handleDeleteUser(user.id, user.email)}
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
      </div>

      {/* 권한 목록 */}
      <div className="mt-6 bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">
          전체 권한 목록
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {permissions.map((perm) => (
            <div
              key={perm.id}
              className="bg-gray-750 p-3 rounded border border-gray-600"
            >
              <h3 className="text-white font-medium text-sm">{perm.name}</h3>
              <p className="text-xs text-gray-400 mt-1">{perm.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 사용자 생성 모달 */}
      {isCreatingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-gray-800 rounded-lg p-4 sm:p-6 max-w-md w-full border border-gray-700">
            <h2 className="text-lg sm:text-xl font-bold text-white mb-4">
              새 사용자 생성
            </h2>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  이메일
                </label>
                <input
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  비밀번호
                </label>
                <input
                  type="password"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  placeholder="********"
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 outline-none"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleCreateUser}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                생성
              </button>
              <button
                onClick={() => {
                  setIsCreatingUser(false);
                  setNewUserEmail('');
                  setNewUserPassword('');
                }}
                className="flex-1 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 역할 할당 모달 */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto">
          <div className="bg-gray-800 rounded-lg p-4 sm:p-6 max-w-md w-full border border-gray-700 my-4">
            <h2 className="text-base sm:text-xl font-bold text-white mb-4 break-words">
              역할 할당: {selectedUser.email}
            </h2>
            <div className="space-y-2 mb-6">
              {roles.map((role) => (
                <label
                  key={role.id}
                  className="flex items-center gap-3 p-3 bg-gray-750 rounded hover:bg-gray-700 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedRoleIds.includes(role.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedRoleIds([...selectedRoleIds, role.id]);
                      } else {
                        setSelectedRoleIds(
                          selectedRoleIds.filter((id) => id !== role.id),
                        );
                      }
                    }}
                    className="w-4 h-4"
                  />
                  <div>
                    <div className="text-white font-medium">{role.name}</div>
                    <div className="text-xs text-gray-400">
                      {role.description}
                    </div>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleAssignRoles}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                저장
              </button>
              <button
                onClick={() => {
                  setSelectedUser(null);
                  setSelectedRoleIds([]);
                }}
                className="flex-1 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
