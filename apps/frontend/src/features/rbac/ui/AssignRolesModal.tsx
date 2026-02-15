import { useState, useEffect } from 'react';
import type { User, Role } from '../../../types/domain.types';

interface AssignRolesModalProps {
  user: User | null;
  roles: Role[];
  onClose: () => void;
  onAssign: (userId: string, roleIds: string[]) => Promise<boolean>;
}

/**
 * AssignRolesModal Component
 * Modal for assigning roles to users
 */
export function AssignRolesModal({
  user,
  roles,
  onClose,
  onAssign,
}: AssignRolesModalProps) {
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);

  useEffect(() => {
    if (user) {
      setSelectedRoleIds(user.roles.map((r) => r.id));
    }
  }, [user]);

  if (!user) return null;

  const handleAssign = async () => {
    const success = await onAssign(user.id, selectedRoleIds);
    if (success) {
      onClose();
    }
  };

  const toggleRole = (roleId: string, checked: boolean) => {
    if (checked) {
      setSelectedRoleIds([...selectedRoleIds, roleId]);
    } else {
      setSelectedRoleIds(selectedRoleIds.filter((id) => id !== roleId));
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto">
      <div className="bg-gray-800 rounded-lg p-4 sm:p-6 max-w-md w-full border border-gray-700 my-4">
        <h2 className="text-base sm:text-xl font-bold text-white mb-4 break-words">
          역할 할당: {user.email}
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
                onChange={(e) => toggleRole(role.id, e.target.checked)}
                className="w-4 h-4"
              />
              <div>
                <div className="text-white font-medium">{role.name}</div>
                <div className="text-xs text-gray-400">{role.description}</div>
              </div>
            </label>
          ))}
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleAssign}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            저장
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            취소
          </button>
        </div>
      </div>
    </div>
  );
}
