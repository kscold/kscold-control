import type { Permission } from '../../../types/domain.types';

interface PermissionsListProps {
  permissions: Permission[];
}

/**
 * PermissionsList Component
 * Displays grid of all available permissions
 */
export function PermissionsList({ permissions }: PermissionsListProps) {
  return (
    <div className="mt-6 bg-gray-800 rounded-lg p-4 border border-gray-700">
      <h2 className="text-lg font-semibold text-white mb-4">전체 권한 목록</h2>
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
  );
}
