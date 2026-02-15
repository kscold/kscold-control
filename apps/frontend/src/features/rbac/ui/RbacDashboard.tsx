import { useState } from 'react';
import { Shield } from 'lucide-react';
import { useUsers, useRoles, useUserActions } from '../hooks';
import {
  RoleList,
  UserList,
  CreateUserModal,
  AssignRolesModal,
  PermissionsList,
} from './';
import type { User } from '../../../types/domain.types';

/**
 * RbacDashboard Component
 * Main RBAC management dashboard
 * Refactored with FSD architecture
 */
export function RbacDashboard() {
  const { users, loading: usersLoading, reload: reloadUsers } = useUsers();
  const { roles, permissions, loading: rolesLoading } = useRoles();
  const {
    createUser,
    updatePassword,
    deleteUser,
    assignRoles,
    resetTerminalLimit,
    updateTerminalLimit,
  } = useUserActions(reloadUsers);

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

  if (usersLoading || rolesLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-white">Loading...</div>
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
