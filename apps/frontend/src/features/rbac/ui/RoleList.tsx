import { Key } from 'lucide-react';
import type { Role } from '../../../types/domain.types';

interface RoleListProps {
  roles: Role[];
}

/**
 * RoleList Component
 * Displays list of roles with their permissions
 */
export function RoleList({ roles }: RoleListProps) {
  return (
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
  );
}
