import { useState } from 'react';
import { AlertTriangle, RefreshCw, Shield } from 'lucide-react';
import {
  useUsers,
  useRoles,
  useUserActions,
  useKeyManagementAccess,
} from '../model';
import { RoleList } from './RoleList';
import { UserList } from './UserList';
import { CreateUserModal } from './CreateUserModal';
import { AssignRolesModal } from './AssignRolesModal';
import { PermissionsList } from './PermissionsList';
import type { User } from '@/entities/user';

/**
 * RBAC 관리 메인 대시보드
 */
export function RbacDashboard() {
  const { users, loading: usersLoading, reload: reloadUsers } = useUsers();
  const { roles, permissions, loading: rolesLoading } = useRoles();
  const {
    targets: keyManagementTargets,
    assignments: keyManagementAssignments,
    loading: keyManagementAccessLoading,
    error: keyManagementAccessError,
    reload: reloadKeyManagementAccess,
  } = useKeyManagementAccess();
  const {
    createUser,
    updatePassword,
    deleteUser,
    assignRoles,
    approveKeyManager,
    updateKeyManagementTargetAccess,
    resetTerminalLimit,
    updateTerminalLimit,
    previewAsUser,
  } = useUserActions(() => {
    void Promise.all([reloadUsers(), reloadKeyManagementAccess()]);
  });

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const handleCreateUser = async (email: string, password: string) => {
    const success = await createUser(email, password);
    return success;
  };

  const handleAssignRoles = (user: User) => {
    setSelectedUser(user);
  };

  const handleSaveRoles = async (userId: string, roleIds: string[]) => {
    const success = await assignRoles(userId, roleIds);
    if (success) {
      setSelectedUser(null);
    }
    return success;
  };

  if (usersLoading || rolesLoading || keyManagementAccessLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (keyManagementAccessError) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-900 p-6">
        <div className="max-w-md rounded-2xl border border-amber-500/30 bg-amber-950/20 p-6 text-amber-100">
          <AlertTriangle size={22} />
          <h1 className="mt-3 font-semibold">
            운영 키 범위를 확인하지 못했습니다
          </h1>
          <p className="mt-2 text-sm text-amber-200/70">
            범위를 모르는 상태에서는 권한 변경을 안전하게 중단합니다.
          </p>
          <button
            type="button"
            onClick={() => void reloadKeyManagementAccess()}
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-amber-400/30 px-3 py-2 text-sm hover:bg-amber-400/10"
          >
            <RefreshCw size={15} /> 다시 불러오기
          </button>
        </div>
      </div>
    );
  }

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
        <RoleList roles={roles} />
        <UserList
          users={users}
          onAssignRoles={handleAssignRoles}
          onUpdatePassword={updatePassword}
          onDelete={deleteUser}
          onResetTerminalLimit={resetTerminalLimit}
          onUpdateTerminalLimit={updateTerminalLimit}
          onCreateUser={() => setShowCreateModal(true)}
          onApproveKeyManager={approveKeyManager}
          keyManagementTargets={keyManagementTargets}
          keyManagementAssignments={keyManagementAssignments}
          onUpdateKeyManagementTargets={updateKeyManagementTargetAccess}
          onPreviewUser={previewAsUser}
        />
      </div>

      <PermissionsList permissions={permissions} />

      <CreateUserModal
        show={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreateUser}
      />

      <AssignRolesModal
        user={selectedUser}
        roles={roles}
        onClose={() => setSelectedUser(null)}
        onAssign={handleSaveRoles}
      />
    </div>
  );
}
