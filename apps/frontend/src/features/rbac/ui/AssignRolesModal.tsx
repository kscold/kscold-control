import { useState, useEffect } from 'react';
import type { User, Role } from '@/entities/user';
import { Dialog, dialogButtonClass } from '@/shared/ui';

interface AssignRolesModalProps {
  user: User | null;
  roles: Role[];
  onClose: () => void;
  onAssign: (userId: string, roleIds: string[]) => Promise<boolean>;
}

/**
 * 사용자에게 역할을 할당하는 모달
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
    <Dialog
      open
      title="역할 할당"
      description={user.email}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className={dialogButtonClass()}
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleAssign}
            className={dialogButtonClass('blue')}
          >
            저장
          </button>
        </>
      }
    >
      <div className="space-y-2">
        {roles.map((role) => (
          <label
            key={role.id}
            className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-800 bg-gray-950/60 p-3 transition hover:border-gray-700 hover:bg-gray-800/60"
          >
            <input
              type="checkbox"
              checked={selectedRoleIds.includes(role.id)}
              onChange={(e) => toggleRole(role.id, e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-blue-500"
            />
            <div className="min-w-0">
              <div className="break-words font-medium text-white">
                {role.name}
              </div>
              <div className="break-words text-xs text-gray-400">
                {role.description}
              </div>
            </div>
          </label>
        ))}
      </div>
    </Dialog>
  );
}
